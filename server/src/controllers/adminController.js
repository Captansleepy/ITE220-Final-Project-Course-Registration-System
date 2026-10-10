
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { publicUser, authError } from "../utils/auth.js";

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validRoles = ["admin", "advisor", "student"];

function sendUser(res, user, status = 200) {
  return res.status(status).json({
    user: {
      ...publicUser(user),
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
}

function handleError(res, error) {
  if (error?.code === 11000) {
    return authError(
      res, 409, "DUPLICATE_VALUE",
      "Email or student ID already exists."
    );
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return authError(
      res, 400, "VALIDATION_ERROR",
      "Please check the submitted user information."
    );
  }

  console.error("Admin API error:", error);
  return authError(
    res, 500, "INTERNAL_SERVER_ERROR",
    "An unexpected server error occurred."
  );
}

export function createAdminController(User, Course, Offering) {
  return {
    async listUsers(req, res) {
      try {
        const filter = {};

        if (req.query.role !== undefined) {
          if (!validRoles.includes(req.query.role)) {
            return authError(
              res, 400, "VALIDATION_ERROR",
              "Invalid role filter."
            );
          }
          filter.role = req.query.role;
        }

        if (req.query.active !== undefined) {
          if (!["true", "false"].includes(req.query.active)) {
            return authError(
              res, 400, "VALIDATION_ERROR",
              "Active filter must be true or false."
            );
          }
          filter.active = req.query.active === "true";
        }

        const users = await User.find(filter)
          .select("-passwordHash")
          .populate("advisor", "name email")
          .sort({ role: 1, name: 1 })
          .lean();

        return res.json({
          users: users.map((user) => ({
            id: String(user._id),
            name: user.name,
            email: user.email,
            role: user.role,
            studentId: user.studentId ?? null,
            advisor: user.advisor
              ? {
                  id: String(user.advisor._id),
                  name: user.advisor.name,
                  email: user.advisor.email,
                }
              : null,
            active: user.active,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          })),
        });
      } catch (error) {
        return handleError(res, error);
      }
    },


    
    async listCourses(req, res) {
      try {
        const courses = await Course.find({})
          .select("code title credits description")
          .sort({ code: 1 })
          .lean();

        return res.json({
          courses: courses.map((course) => ({
            id: String(course._id),
            code: course.code,
            title: course.title,
            credits: course.credits,
            description: course.description,
          })),
        });
      } catch (error) {
        console.error("List courses error:", error);
        return authError(
          res,
          500,
          "INTERNAL_SERVER_ERROR",
          "Unable to load courses."
        );
      }
    },

    async listSections(req, res) {
      try {
        const offerings = await Offering.find({})
          .populate("course", "code title credits")
          .populate("term", "code isCurrent")
          .lean();

        offerings.sort((a, b) => {
          const codeA = a.course?.code || "";
          const codeB = b.course?.code || "";
          return codeA.localeCompare(codeB) || a.section - b.section;
        });

        return res.json({
          sections: offerings.map((offering) => ({
            id: String(offering._id),
            courseCode: offering.course?.code || "Unknown",
            courseTitle: offering.course?.title || "Unknown",
            section: offering.section,
            term: offering.term?.code || "Unknown",
            meetings: offering.meetings,
            room: offering.room,
            instructor: offering.instructor,
            capacity: offering.capacity,
            addDropOpen: offering.addDropOpen,
          })),
        });
      } catch (error) {
        console.error("List sections error:", error);
        return authError(
          res,
          500,
          "INTERNAL_SERVER_ERROR",
          "Unable to load sections."
        );
      }
    },

    async createUser(req, res) {
      try {
        const {
          name, email, password, role, studentId, advisor,
        } = req.body || {};

        if (
          typeof name !== "string" ||
          !name.trim() ||
          name.trim().length > 100 ||
          typeof email !== "string" ||
          email.length > 254 ||
          !validEmail.test(email.trim()) ||
          typeof password !== "string" ||
          password.length < 8 ||
          Buffer.byteLength(password, "utf8") > 72 ||
          !validRoles.includes(role)
        ) {
          return authError(
            res, 400, "VALIDATION_ERROR",
            "Enter a valid name, email, password (8–72 bytes), and role."
          );
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (await User.exists({ email: normalizedEmail })) {
          return authError(
            res, 409, "DUPLICATE_EMAIL",
            "This email is already in use."
          );
        }

        const userData = {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash: await bcrypt.hash(password, 12),
          role,
          active: true,
        };

        if (role === "student") {
          if (
            typeof studentId !== "string" ||
            !studentId.trim() ||
            typeof advisor !== "string" ||
            !mongoose.isValidObjectId(advisor)
          ) {
            return authError(
              res, 400, "VALIDATION_ERROR",
              "Students require a student ID and a valid advisor ID."
            );
          }

          const advisorUser = await User.findOne({
            _id: advisor,
            role: "advisor",
            active: true,
          });

          if (!advisorUser) {
            return authError(
              res, 400, "INVALID_ADVISOR",
              "Select an existing active advisor."
            );
          }

          userData.studentId = studentId.trim();
          userData.advisor = advisorUser._id;
        }

        const user = await User.create(userData);
        return sendUser(res, user, 201);
      } catch (error) {
        return handleError(res, error);
      }
    },

    // Safe deletion: preserve grade and registration history by deactivating users
    // who are referenced by academic records or assigned students.
    async deleteUser(req, res) {
      try {
        if (!mongoose.isValidObjectId(req.params.id)) {
          return authError(res, 400, "INVALID_ID", "Invalid user ID.");
        }
        if (String(req.params.id) === String(req.user._id)) {
          return authError(res, 400, "SELF_DELETE_RESTRICTED", "You cannot delete your own account.");
        }
        const user = await User.findById(req.params.id);
        if (!user) return authError(res, 404, "USER_NOT_FOUND", "User not found.");

        // Do not deactivate the last active administrator.
        // Transactional/concurrent changes still require integration testing.
        if (user.role === "admin" && user.active) {
          const count = await User.countDocuments({ role: "admin", active: true });
          if (count <= 1) return authError(res, 409, "LAST_ADMIN", "The last active admin cannot be deleted.");
        }

        // Never hard-delete an account that other collections might reference.
        // Inactivation is also required for advisor accounts with assignments.
        user.active = false;
        await user.save();
        return res.json({
          deleted: false,
          deactivated: true,
          user: { ...publicUser(user), active: false },
          message: "Account deactivated to preserve academic records and references.",
        });
      } catch (error) {
        return handleError(res, error);
      }
    },

    async updateUser(req, res) {
      try {
        if (!mongoose.isValidObjectId(req.params.id)) {
          return authError(
            res, 400, "INVALID_ID", "Invalid user ID."
          );
        }

        const user = await User.findById(req.params.id)
          .select("+passwordHash");

        if (!user) {
          return authError(
            res, 404, "USER_NOT_FOUND", "User not found."
          );
        }

        const body = req.body || {};
        const allowed = [
          "name", "email", "role", "studentId",
          "advisor", "active", "password",
        ];

        if (
          Object.keys(body).length === 0 ||
          Object.keys(body).some((key) => !allowed.includes(key))
        ) {
          return authError(
            res, 400, "VALIDATION_ERROR",
            "Provide only supported user fields."
          );
        }

        if (
          user._id.equals(req.user._id) &&
          (body.active === false ||
            (body.role !== undefined && body.role !== "admin"))
        ) {
          return authError(
            res, 400, "SELF_UPDATE_RESTRICTED",
            "You cannot deactivate yourself or remove your own admin role."
          );
        }

        // Guard admin role demotion as well as deactivation.
        if (user.role === "admin" && user.active &&
            (body.active === false ||
             (body.role !== undefined && body.role !== "admin"))) {
          const activeAdmins = await User.countDocuments({ role: "admin", active: true });
          if (activeAdmins <= 1) {
            return authError(res, 409, "LAST_ADMIN", "The last active admin cannot be removed.");
          }
        }

        if (body.name !== undefined) {
          if (
            typeof body.name !== "string" ||
            !body.name.trim() ||
            body.name.trim().length > 100
          ) {
            return authError(
              res, 400, "VALIDATION_ERROR", "Invalid name."
            );
          }
          user.name = body.name.trim();
        }

        if (body.email !== undefined) {
          if (
            typeof body.email !== "string" ||
            body.email.length > 254 ||
            !validEmail.test(body.email.trim())
          ) {
            return authError(
              res, 400, "VALIDATION_ERROR", "Invalid email."
            );
          }
          user.email = body.email.trim().toLowerCase();
        }

        if (body.role !== undefined) {
          if (!validRoles.includes(body.role)) {
            return authError(
              res, 400, "VALIDATION_ERROR", "Invalid role."
            );
          }
          user.role = body.role;
        }

        if (body.active !== undefined) {
          if (typeof body.active !== "boolean") {
            return authError(
              res, 400, "VALIDATION_ERROR",
              "Active must be true or false."
            );
          }

          if (body.active === false && user.role === "admin") {
            const activeAdmins = await User.countDocuments({
              role: "admin",
              active: true,
            });

            if (activeAdmins <= 1) {
              return authError(
                res, 400, "LAST_ADMIN",
                "The last active admin cannot be deactivated."
              );
            }
          }

          user.active = body.active;
        }

        if (body.password !== undefined) {
          if (
            typeof body.password !== "string" ||
            body.password.length < 8 ||
            Buffer.byteLength(body.password, "utf8") > 72
          ) {
            return authError(
              res, 400, "VALIDATION_ERROR",
              "Password must be 8–72 bytes."
            );
          }
          user.passwordHash = await bcrypt.hash(body.password, 12);
        }

        if (user.role === "student") {
          const nextStudentId =
            body.studentId !== undefined
              ? body.studentId
              : user.studentId;

          const nextAdvisor =
            body.advisor !== undefined
              ? body.advisor
              : user.advisor?.toString();

          if (
            typeof nextStudentId !== "string" ||
            !nextStudentId.trim() ||
            !nextAdvisor ||
            !mongoose.isValidObjectId(nextAdvisor)
          ) {
            return authError(
              res, 400, "VALIDATION_ERROR",
              "Students require a student ID and advisor ID."
            );
          }

          const advisorUser = await User.findOne({
            _id: nextAdvisor,
            role: "advisor",
            active: true,
          });

          if (!advisorUser) {
            return authError(
              res, 400, "INVALID_ADVISOR",
              "Select an existing active advisor."
            );
          }

          user.studentId = nextStudentId.trim();
          user.advisor = advisorUser._id;
        } else {
          user.studentId = undefined;
          user.advisor = undefined;
        }

        await user.save();
        return sendUser(res, user);
      } catch (error) {
        return handleError(res, error);
      }
    },
  };
}