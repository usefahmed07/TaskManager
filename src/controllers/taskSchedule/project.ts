import type { Request, Response } from "express";
import Project from "../../model/taskSchedule.js";
import Task from "../../model/task.js";
import { status } from "../../config/status.js";
import { message } from "../../config/message.js";
import { errorMessage } from "../../util/errorMessage.js";

const isText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isDate = (value: unknown): boolean => !Number.isNaN(Date.parse(String(value)));

class MyProject {
    addProject = async (req: Request, res: Response) => {
        try {
            const userId = req.user!._id;
            const { projectName, projectDescription, dueDate } = req.body;

            if (!isText(projectName) || !isText(projectDescription)) {
                return res.status(406).json({ status: status.NOT_ACCEPTABLE, message: message.EMPTY_FIELD });
            }
            if (dueDate !== undefined && !isDate(dueDate)) {
                return res.status(400).json({ status: status.BAD_REQUEST, message: "INVALID DUE DATE." });
            }

            const created = await Project.create({
                userId,
                projectName: projectName.trim(),
                projectDescription: projectDescription.trim(),
                dueDate
            });

            return res.status(201).json({ status: status.CREATED, message: message.PROJECT_CREATE, data: created });
        } catch (error) {
            return res.status(400).json({ status: status.BAD_REQUEST, message: errorMessage(error) });
        }
    };

    getProjects = async (req: Request, res: Response) => {
        try {
            const userId = req.user!._id;
            const page = Math.max(parseInt(String(req.query.page ?? "")) || 1, 1);
            const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "")) || 10, 1), 100);

            const [data, total] = await Promise.all([
                Project.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
                Project.countDocuments({ userId })
            ]);

            return res.status(200).json({
                status: status.SUCCESS,
                data,
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
            });
        } catch (error) {
            return res.status(400).json({ status: status.BAD_REQUEST, message: errorMessage(error) });
        }
    };

    getProjectById = async (req: Request, res: Response) => {
        try {
            const userId = req.user!._id;
            const { id } = req.params;

            const getProject = await Project.findOne({ _id: id, userId });

            if (!getProject) {
                return res.status(404).json({ status: status.NOT_FOUND, message: message.NOT_FOUND });
            }

            return res.status(200).json({ status: status.SUCCESS, data: getProject });
        } catch (error) {
            return res.status(400).json({ status: status.BAD_REQUEST, message: errorMessage(error) });
        }
    };

    updateProject = async (req: Request, res: Response) => {
        try {
            const { _id } = req.user!;
            const { id } = req.params;
            const { projectName, projectDescription, dueDate } = req.body;
            const updates: Record<string, unknown> = {};

            if (projectName !== undefined) {
                if (!isText(projectName)) return res.status(400).json({ status: status.BAD_REQUEST, message: message.EMPTY_FIELD });
                updates.projectName = projectName.trim();
            }
            if (projectDescription !== undefined) {
                if (!isText(projectDescription)) return res.status(400).json({ status: status.BAD_REQUEST, message: message.EMPTY_FIELD });
                updates.projectDescription = projectDescription.trim();
            }
            if (dueDate !== undefined) {
                if (!isDate(dueDate)) return res.status(400).json({ status: status.BAD_REQUEST, message: "INVALID DUE DATE." });
                updates.dueDate = dueDate;
            }
            if (Object.keys(updates).length === 0) {
                return res.status(406).json({ status: status.NOT_ACCEPTABLE, message: message.EMPTY_FIELD });
            }

            const updated = await Project.findOneAndUpdate(
                { _id: id, userId: _id },
                { $set: updates },
                { new: true, runValidators: true }
            );

            if (!updated) {
                return res.status(404).json({ status: status.NOT_FOUND, message: message.NOT_FOUND });
            }

            return res.status(200).json({ status: status.SUCCESS, message: message.PROJECT_UPDATE, data: updated });
        } catch (error) {
            return res.status(400).json({ status: status.BAD_REQUEST, message: errorMessage(error) });
        }
    };

    deleteProject = async (req: Request, res: Response) => {
        try {
            const { _id } = req.user!;
            const { id } = req.params;

            const deleted = await Project.findOneAndDelete({ _id: id, userId: _id });

            if (!deleted) {
                return res.status(404).json({ status: status.NOT_FOUND, message: message.NOT_FOUND });
            }

            await Task.deleteMany({ projectId: id, userId: _id });

            return res.status(200).json({ status: status.SUCCESS, message: message.PROJECT_DELETE });
        } catch (error) {
            return res.status(400).json({ status: status.BAD_REQUEST, message: errorMessage(error) });
        }
    };
}

const project = new MyProject();
export { project };
