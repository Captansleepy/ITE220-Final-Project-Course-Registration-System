function Navbar({ user, onLogout }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h2>Course Registration System</h2>
      </div>

      <div className="navbar-user">
        {user && (
          <span>
            Welcome, <strong>{user.name}</strong>
          </span>
        )}

        <button className="logout-button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;