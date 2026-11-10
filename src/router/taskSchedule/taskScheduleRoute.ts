import express from "express";
import { authUser } from "../../auth/auth.js";
import { project } from "../../controllers/taskSchedule/project.js";
const router = express.Router();

router.route("/")
.post(authUser,project.addProject)
.get(authUser,project.getProjects);

router.route("/:id")
.get(authUser,project.getProjectById)
.patch(authUser,project.updateProject)
.delete(authUser,project.deleteProject);

export default router;
