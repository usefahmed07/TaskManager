import Task from "../../model/task.js";
import Project from "../../model/taskSchedule.js";
import { status } from "../../config/status.js";
import { message } from "../../config/message.js";

const TASK_STATUS = ["INPROGRESS","COMPLETED","PENDING"];
const SORT_FIELDS = ["dueDate","taskName"];

const isText = (value) => typeof value === "string" && value.trim().length > 0;
const isDate = (value) => !Number.isNaN(Date.parse(value));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

class ProjectTask {
    createTask = async(req,res) =>{
        try {
            const { taskName,taskDescription,dueDate,taskStatus } = req.body;
            const userId = req.user._id;
            const { projectId } = req.params;

            if(!isText(taskName) || !isText(taskDescription) || !dueDate || !taskStatus) {
                return res.status(406).json({status:status.NOT_ACCEPTABLE,message:message.EMPTY_FIELD});
            }
            if(!isDate(dueDate)) {
                return res.status(400).json({status:status.BAD_REQUEST,message:"INVALID DUE DATE."});
            }
            if(!TASK_STATUS.includes(taskStatus)) {
                return res.status(400).json({status:status.BAD_REQUEST,message:`STATUS MUST BE ONE OF: ${TASK_STATUS.join(", ")}.`});
            }

            const project = await Project.findOne({ _id:projectId,userId });

            if(!project) {
                return res.status(404).json({status:status.NOT_FOUND,message:message.NOT_FOUND});
            }

            const created = await Task.create({
                userId,
                projectId,
                taskName:taskName.trim(),
                taskDescription:taskDescription.trim(),
                dueDate,
                status:taskStatus
            });

            return res.status(201).json({status:status.CREATED,message:message.TASK_CREATE,data:created});
        } catch (error) {
            return res.status(400).json({status:status.BAD_REQUEST,message:message.BAD_REQUEST});
        }
    }

    getAllTask = async(req,res) =>{
        try {
            const { projectId } = req.params;
            const { _id } = req.user;
            const { status:taskStatus,search,sortBy,order } = req.query;

            const page = Math.max(parseInt(req.query.page) || 1,1);
            const limit = Math.min(Math.max(parseInt(req.query.limit) || 10,1),100);
            const filter = { projectId,userId:_id };

            if(taskStatus !== undefined) {
                if(!TASK_STATUS.includes(taskStatus)) {
                    return res.status(400).json({status:status.BAD_REQUEST,message:`STATUS MUST BE ONE OF: ${TASK_STATUS.join(", ")}.`});
                }
                filter.status = taskStatus;
            }
            if(typeof search === "string" && search.trim()) {
                filter.taskName = { $regex:escapeRegex(search.trim()),$options:"i" };
            }

            const sortField = SORT_FIELDS.includes(sortBy) ? sortBy : "_id";
            const sort = { [sortField]: order === "desc" ? -1 : 1 };

            const [data,total] = await Promise.all([
                Task.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
                Task.countDocuments(filter)
            ]);

            return res.status(200).json({
                status:status.SUCCESS,
                data,
                pagination:{ page,limit,total,totalPages:Math.ceil(total / limit) }
            });
        } catch (error) {
            return res.status(400).json({status:status.BAD_REQUEST,message:message.BAD_REQUEST});
        }
    }

    editTask = async(req,res) =>{
        try {
            const { projectId,taskId } = req.params;
            const { _id } = req.user;
            const { taskName,taskDescription,dueDate,taskStatus } = req.body;
            const updates = {};

            if(taskName !== undefined) {
                if(!isText(taskName)) return res.status(400).json({status:status.BAD_REQUEST,message:message.EMPTY_FIELD});
                updates.taskName = taskName.trim();
            }
            if(taskDescription !== undefined) {
                if(!isText(taskDescription)) return res.status(400).json({status:status.BAD_REQUEST,message:message.EMPTY_FIELD});
                updates.taskDescription = taskDescription.trim();
            }
            if(dueDate !== undefined) {
                if(!isDate(dueDate)) return res.status(400).json({status:status.BAD_REQUEST,message:"INVALID DUE DATE."});
                updates.dueDate = dueDate;
            }
            if(taskStatus !== undefined) {
                if(!TASK_STATUS.includes(taskStatus)) {
                    return res.status(400).json({status:status.BAD_REQUEST,message:`STATUS MUST BE ONE OF: ${TASK_STATUS.join(", ")}.`});
                }
                updates.status = taskStatus;
            }
            if(Object.keys(updates).length === 0) {
                return res.status(406).json({status:status.NOT_ACCEPTABLE,message:message.EMPTY_FIELD});
            }

            const project = await Project.findOne({ _id:projectId,userId:_id });

            if(!project) {
                return res.status(404).json({status:status.NOT_FOUND,message:message.NOT_FOUND});
            }

            const updateTask = await Task.findOneAndUpdate(
                { _id:taskId,projectId,userId:_id },
                { $set:updates },
                { new:true,runValidators:true }
            );

            if(!updateTask) {
                return res.status(404).json({status:status.NOT_FOUND,message:message.NOT_FOUND});
            }

            return res.status(200).json({status:status.SUCCESS,message:message.TASK_UPDATE,data:updateTask});
        } catch (error) {
            return res.status(400).json({status:status.BAD_REQUEST,message:message.BAD_REQUEST});
        }
    }

    deleteTask = async(req,res) =>{
        try {
            const { projectId,taskId } = req.params;
            const { _id } = req.user;

            const project = await Project.findOne({ _id:projectId,userId:_id });

            if(!project) {
                return res.status(404).json({status:status.NOT_FOUND,message:message.NOT_FOUND});
            }

            const deleteTask = await Task.findOneAndDelete({ _id:taskId,projectId,userId:_id });

            if(!deleteTask) {
                return res.status(404).json({status:status.NOT_FOUND,message:message.NOT_FOUND});
            }

            return res.status(200).json({status:status.SUCCESS,message:message.TASK_DELETE});
        } catch (error) {
            return res.status(400).json({status:status.BAD_REQUEST,message:message.BAD_REQUEST});
        }
    }
}

const taskObj = new ProjectTask();
export { taskObj };
