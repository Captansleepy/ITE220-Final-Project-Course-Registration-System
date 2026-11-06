import {useCallback,useEffect,useRef,useState} from 'react';
import {apiRequest} from '../api.js';
import './AddDropRequests.css';
const date=value=>new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(value));
export default function AddDropRequests({advisor=false,onChanged}) {
  const base=advisor?'/advisor':'/student';
  const [data,setData]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [busy,setBusy]=useState(false),[offeringId,setOfferingId]=useState(''),[reason,setReason]=useState(''),[responses,setResponses]=useState({});
  const [now,setNow]=useState(Date.now);
  const alive=useRef(false),versions=useRef(null),callback=useRef(onChanged);
  useEffect(()=>{callback.current=onChanged;},[onChanged]);
  const load=useCallback(async(signal)=>{
    try {
      const [requests,options]=await Promise.all([apiRequest(`${base}/requests`,{signal}),advisor?Promise.resolve({offerings:[]}):apiRequest('/student/request-offerings',{signal})]);
      if(signal?.aborted||!alive.current)return;
      const next=Object.fromEntries(requests.requests.map(r=>[r.id,r.status]));
      const changed=versions.current&&requests.requests.some(r=>r.status==='approved'&&versions.current[r.id]!==r.status);
      versions.current=next;setData({...requests,...options});setError('');
      if(changed)callback.current?.();
    }catch(e){if(!signal?.aborted&&alive.current)setError(e.message);}
  },[base,advisor]);
  useEffect(()=>{
    alive.current=true;const controller=new AbortController();
    // The callback applies state only after the network request completes.
    const initial = Promise.resolve().then(() => load(controller.signal));
    void initial;
    const poll=setInterval(()=>void load(controller.signal),15000);
    const clock=setInterval(()=>setNow(Date.now()),1000);
    return()=>{alive.current=false;controller.abort();clearInterval(poll);clearInterval(clock);};
  },[load]);
  async function mutate(path,body) {
    if(busy)return false;setBusy(true);setError('');setMessage('');
    try {await apiRequest(path,{method:'POST',body:JSON.stringify(body)});await load();if(alive.current)setMessage('Request updated successfully.');return true;}
    catch(e){if(alive.current)setError(e.message);return false;}
    finally{if(alive.current)setBusy(false);}
  }
  const open=o=>o.addDropOpen&&o.addDropClosesAt&&new Date(o.addDropClosesAt).getTime()>now;
  const options=data?.offerings??[];
  const selected=options.find(o=>o.id===offeringId);
  const allowed=o=>open(o)&&!o.pending&&(o.registered||o.eligible);
  async function submit(e) {
    e.preventDefault();if(!selected||!allowed(selected))return;
    if(await mutate('/student/requests',{offeringId,action:selected.registered?'drop':'add',reason})) {setReason('');setOfferingId('');}
  }
  async function review(row,decision) {
    if(!window.confirm(`${decision==='approved'?'Approve':'Reject'} ${row.action} request for ${row.student?.name}, ${row.offering?.courseCode}?`))return;
    await mutate(`/advisor/requests/${row.id}/review`,{decision,response:responses[row.id]??''});
  }
  const rows=data?.requests??[];
  return <section className={advisor?'dashboard-panel request-panel':'dashboard-section request-panel'} aria-label="Add and drop requests">
    <div className="request-heading"><div><p className="eyebrow">{advisor?'Advisor inbox':'Student services'}</p><h2>Add / Drop Requests {advisor&&data?`(${data.pendingCount} pending)`:''}</h2></div><button type="button" disabled={busy} onClick={()=>void load()}>Refresh requests</button></div>
    <p>{advisor?'Review requests from your currently assigned students. Approval checks the deadline, grades, available seats and timetable again.':'Submit a request to your assigned advisor. Your registration changes only after approval; a pending request does not reserve a seat.'}</p>
    <p className="request-muted">Updates are checked every 15 seconds. Dates use Bangkok time.</p>
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    {!data?<p role="status">Loading requests…</p>:<>
      {!advisor&&<form className="request-form" onSubmit={submit}>
        <label htmlFor="request-course">Course and section</label>
        <select id="request-course" value={offeringId} onChange={e=>setOfferingId(e.target.value)} required disabled={busy}>
          <option value="">Choose a course to add or drop</option>
          {options.map(o=><option key={o.id} value={o.id} disabled={!allowed(o)}>{o.registered?'Drop':'Add'} {o.courseCode} · Section {o.section} · {o.term}{!open(o)?' — Window closed':o.pending?' — Request pending':!o.registered&&!o.eligible?` — ${o.reason}`:''}</option>)}
        </select>
        {selected&&<p>{selected.courseTitle} · {selected.meetings.map(m=>`${m.day} ${m.startTime}–${m.endTime}`).join(', ')}<br/>Closes {selected.addDropClosesAt?date(selected.addDropClosesAt):'date not set'} · {selected.seatsRemaining} seats remaining</p>}
        <label htmlFor="request-reason">Reason</label>
        <textarea id="request-reason" required minLength={5} maxLength={1000} rows={3} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy} placeholder="Explain why you want to add or drop this course."/>
        <button type="submit" disabled={busy||!selected||!allowed(selected)||reason.trim().length<5}>{busy?'Saving…':'Submit request'}</button>
        <p className="request-muted">If the window is closed or a course is unavailable, contact your advisor.</p>
      </form>}
      <h3>{advisor?'Requests from assigned students':'Your request history'}</h3>
      {!rows.length&&<p>No requests yet.</p>}
      <div className="request-list">{[...rows].sort((a,b)=>Number(b.status==='pending')-Number(a.status==='pending')).map(row=><article className="request-card" key={row.id}>
        <div className="request-heading"><h4>{row.action==='add'?'Add':'Drop'} {row.offering?.courseCode??'Removed offering'} · Section {row.offering?.section??'—'}</h4><span className={`request-status request-status-${row.status}`}>{row.status}</span></div>
        {advisor&&<p><strong>{row.student?.name??'Unavailable student'}</strong> ({row.student?.studentId})</p>}
        <p className="request-muted">Submitted {date(row.createdAt)} · {row.offering?.term}</p>
        <p className="request-reason">{row.reason}</p>
        {row.response&&<p className="request-reason"><strong>Advisor response:</strong> {row.response}</p>}
        {row.resolvedAt&&<p className="request-muted">{row.reviewedBy?`Reviewed by ${row.reviewedBy} · `:''}{date(row.resolvedAt)}</p>}
        {row.status==='pending'&&(advisor?<div className="request-review">
          <label htmlFor={`response-${row.id}`}>Response (required to reject)</label>
          <textarea id={`response-${row.id}`} maxLength={1000} rows={2} value={responses[row.id]??''} onChange={e=>setResponses({...responses,[row.id]:e.target.value})} disabled={busy}/>
          <div className="request-actions"><button disabled={busy||!row.offering||!open(row.offering)} type="button" onClick={()=>review(row,'approved')}>Approve {row.action}</button><button disabled={busy||(responses[row.id]??'').trim().length<5} type="button" onClick={()=>review(row,'rejected')}>Reject request</button></div>
          {(!row.offering||!open(row.offering))&&<p>Window closed. Reopen it in Offering Management before approval, or reject with an explanation.</p>}
        </div>:<button disabled={busy} type="button" onClick={()=>{if(window.confirm('Cancel this pending request?'))void mutate(`/student/requests/${row.id}/cancel`,{});}}>Cancel request</button>)}
      </article>)}</div>
      <p className="request-muted">Showing up to 200 most recent requests.</p>
    </>}
  </section>;
}
