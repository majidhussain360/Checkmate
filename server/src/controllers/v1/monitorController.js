import {
	getMonitorByIdParamValidation,
	getMonitorByIdQueryValidation,
	getMonitorsByTeamIdParamValidation,
	getMonitorsByTeamIdQueryValidation,
	createMonitorBodyValidation,
	editMonitorBodyValidation,
	pauseMonitorParamValidation,
	getMonitorStatsByIdParamValidation,
	getMonitorStatsByIdQueryValidation,
	getCertificateParamValidation,
	getHardwareDetailsByIdParamValidation,
	getHardwareDetailsByIdQueryValidation,
} from "../../validation/joi.js";
import sslChecker from "ssl-checker";
import { fetchMonitorCertificate } from "./controllerUtils.js";
import BaseController from "./baseController.js";
import fs from "fs/promises";
import path from "path";

const SERVICE_NAME = "monitorController";
class MonitorController extends BaseController {
	static SERVICE_NAME = SERVICE_NAME;
	constructor(commonDependencies, { settingsService, jobQueue, emailService, monitorService }) {
		super(commonDependencies);
		this.settingsService = settingsService;
		this.jobQueue = jobQueue;
		this.emailService = emailService;
		this.monitorService = monitorService;
	}

	get serviceName() {
		return MonitorController.SERVICE_NAME;
	}

	async verifyTeamAccess(teamId, monitorId) {
		const monitor = await this.db.monitorModule.getMonitorById(monitorId);
		if (!monitor.teamId.equals(teamId)) {
			throw this.errorService.createAuthorizationError();
		}
	}

	getAllMonitors = this.asyncHandler(
		async (req, res) => {
			const monitors = await this.monitorService.getAllMonitors();
			return res.success({
				msg: this.stringService.monitorGetAll,
				data: monitors,
			});
		},
		SERVICE_NAME,
		"getAllMonitors"
	);

	getUptimeDetailsById = this.asyncHandler(
		async (req, res) => {
			const monitorId = req?.params?.monitorId;
			const dateRange = req?.query?.dateRange;
			const normalize = req?.query?.normalize;

			const teamId = req?.user?.teamId;

			if (!teamId) {
				throw this.errorService.createBadRequestError("Team ID is required");
			}

			const data = await this.monitorService.getUptimeDetailsById({
				teamId,
				monitorId,
				dateRange,
				normalize,
			});
			return res.success({
				msg: this.stringService.monitorGetByIdSuccess,
				data: data,
			});
		},
		SERVICE_NAME,
		"getUptimeDetailsById"
	);

	getMonitorStatsById = this.asyncHandler(
		async (req, res) => {
			await getMonitorStatsByIdParamValidation.validateAsync(req.params);
			await getMonitorStatsByIdQueryValidation.validateAsync(req.query);

			let { limit, sortOrder, dateRange, numToDisplay, normalize } = req.query;
			const monitorId = req?.params?.monitorId;

			const teamId = req?.user?.teamId;
			if (!teamId) {
				throw this.errorService.createBadRequestError("Team ID is required");
			}

			const monitorStats = await this.monitorService.getMonitorStatsById({
				teamId,
				monitorId,
				limit,
				sortOrder,
				dateRange,
				numToDisplay,
				normalize,
			});

			return res.success({
				msg: this.stringService.monitorStatsById,
				data: monitorStats,
			});
		},
		SERVICE_NAME,
		"getMonitorStatsById"
	);

	/**
	 * Get hardware details for a specific monitor by ID
	 * @async
	 * @param {Express.Request} req - Express request object containing monitorId in params
	 * @param {Express.Response} res - Express response object
	 * @param {Express.NextFunction} next - Express next middleware function
	 * @returns {Promise<Express.Response>}
	 * @throws {Error} - Throws error if monitor not found or other database errors
	 */
	getHardwareDetailsById = this.asyncHandler(
		async (req, res) => {
			await getHardwareDetailsByIdParamValidation.validateAsync(req.params);
			await getHardwareDetailsByIdQueryValidation.validateAsync(req.query);

			const monitorId = req?.params?.monitorId;
			const dateRange = req?.query?.dateRange;
			const teamId = req?.user?.teamId;
			if (!teamId) {
				throw this.errorService.createBadRequestError("Team ID is required");
			}

			const monitor = await this.monitorService.getHardwareDetailsById({
				teamId,
				monitorId,
				dateRange,
			});

			return res.success({
				msg: this.stringService.monitorGetByIdSuccess,
				data: monitor,
			});
		},
		SERVICE_NAME,
		"getHardwareDetailsById"
	);

	getMonitorCertificate = this.asyncHandler(
		async (req, res) => {
			await getCertificateParamValidation.validateAsync(req.params);

			const { monitorId } = req.params;
			const monitor = await this.db.monitorModule.getMonitorById(monitorId);
			const certificate = await fetchMonitorCertificate(sslChecker, monitor);

			return res.success({
				msg: this.stringService.monitorCertificate,
				data: {
					certificateDate: new Date(certificate.validTo),
				},
			});
		},
		SERVICE_NAME,
		"getMonitorCertificate"
	);

	getMonitorById = this.asyncHandler(
		async (req, res) => {
			await getMonitorByIdParamValidation.validateAsync(req.params);
			await getMonitorByIdQueryValidation.validateAsync(req.query);

			const teamId = req?.user?.teamId;
			if (!teamId) {
				throw this.errorService.createBadRequestError("Team ID is required");
			}

			const monitor = await this.monitorService.getMonitorById({ teamId, monitorId: req?.params?.monitorId });

			return res.success({
				msg: this.stringService.monitorGetByIdSuccess,
				data: monitor,
			});
		},
		SERVICE_NAME,
		"getMonitorById"
	);

	createMonitor = this.asyncHandler(
		async (req, res) => {
			await createMonitorBodyValidation.validateAsync(req.body);

			const userId = req?.user?._id;
			const teamId = req?.user?.teamId;

			const monitor = await this.monitorService.createMonitor({ teamId, userId, body: req.body });

			return res.success({
				msg: this.stringService.monitorCreate,
				data: monitor,
			});
		},
		SERVICE_NAME,
		"createMonitor"
	);

	createBulkMonitors = this.asyncHandler(
		async (req, res) => {
			// support req.file, req.files.csvFile, or multer fields
			const file = req.file || (req.files && (req.files.csvFile ? req.files.csvFile[0] : Object.values(req.files)[0]));

			if (!file) {
				console.warn(
					"createBulkMonitors: no file found on req - req.file:",
					!!req.file,
					"req.files keys:",
					req.files ? Object.keys(req.files) : null
				);
				throw this.errorService.createBadRequestError("No file uploaded. Ensure form field name is 'csvFile' and enctype='multipart/form-data'.");
			}

			const originalName = (file.originalname || file.name || "").toString();
			const ext = (path.extname(originalName) || "").toLowerCase();

			const allowedMimes = ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain", "application/octet-stream"];

			const mimetypeOk = typeof file.mimetype === "string" && (allowedMimes.includes(file.mimetype) || file.mimetype.includes("csv"));
			if (!mimetypeOk && ext !== ".csv") {
				console.warn("createBulkMonitors: rejected file mime/extension", { mimetype: file.mimetype, ext, originalName });
				throw this.errorService.createBadRequestError(
					"File is not a CSV. Accepted extensions: .csv (mimetypes: text/csv, text/plain, application/vnd.ms-excel)."
				);
			}

			const size = file.size ?? (file.buffer ? file.buffer.length : 0);
			if (!size) {
				throw this.errorService.createBadRequestError("File is empty");
			}

			const userId = req?.user?._id;
			const teamId = req?.user?.teamId;
			if (!userId || !teamId) {
				throw this.errorService.createBadRequestError("Missing userId or teamId");
			}

			// read file content from buffer (preferred) or from disk path
			let fileData;
			if (file.buffer) {
				fileData = file.buffer.toString("utf-8");
			} else if (file.path) {
				try {
					fileData = await fs.readFile(file.path, "utf-8");
				} catch (err) {
					console.error("createBulkMonitors: failed reading file.path", file.path, err);
					throw this.errorService.createBadRequestError("Cannot read uploaded file");
				}
			} else {
				throw this.errorService.createBadRequestError("Cannot get file from upload (no buffer or path)");
			}

			const monitors = await this.monitorService.createBulkMonitors({ fileData, userId, teamId });

			return res.success({
				msg: this.stringService.bulkMonitorsCreate,
				data: monitors,
			});
		},
		SERVICE_NAME,
		"createBulkMonitors"
	);

	deleteMonitor = this.asyncHandler(
		async (req, res) => {
			await getMonitorByIdParamValidation.validateAsync(req.params);
			const monitorId = req.params.monitorId;
			const teamId = req?.user?.teamId;
			if (!teamId) {
				throw this.errorService.createBadRequestError("Team ID is required");
			}

			const deletedMonitor = await this.monitorService.deleteMonitor({ teamId, monitorId });

			return res.success({ msg: this.stringService.monitorDelete, data: deletedMonitor });
		},
		SERVICE_NAME,
		"deleteMonitor"
	);

	deleteAllMonitors = this.asyncHandler(
		async (req, res) => {
			const teamId = req?.user?.teamId;
			if (!teamId) {
				throw this.errorService.createBadRequestError("Team ID is required");
			}

			const deletedCount = await this.monitorService.deleteAllMonitors({ teamId });

			return res.success({ msg: `Deleted ${deletedCount} monitors` });
		},
		SERVICE_NAME,
		"deleteAllMonitors"
	);

	editMonitor = this.asyncHandler(
		async (req, res) => {
			await getMonitorByIdParamValidation.validateAsync(req.params);
			await editMonitorBodyValidation.validateAsync(req.body);
			const monitorId = req?.params?.monitorId;

			const teamId = req?.user?.teamId;
			if (!teamId) {
				throw this.errorService.createBadRequestError("Team ID is required");
			}

			const editedMonitor = await this.monitorService.editMonitor({ teamId, monitorId, body: req.body });

			return res.success({
				msg: this.stringService.monitorEdit,
				data: editedMonitor,
			});
		},
		SERVICE_NAME,
		"editMonitor"
	);

	pauseMonitor = this.asyncHandler(
		async (req, res) => {
			await pauseMonitorParamValidation.validateAsync(req.params);

			const monitorId = req.params.monitorId;
			const teamId = req?.user?.teamId;
			if (!teamId) {
				throw this.errorService.createBadRequestError("Team ID is required");
			}

			const monitor = await this.monitorService.pauseMonitor({ teamId, monitorId });

			return res.success({
				msg: monitor.isActive ? this.stringService.monitorResume : this.stringService.monitorPause,
				data: monitor,
			});
		},
		SERVICE_NAME,
		"pauseMonitor"
	);

	addDemoMonitors = this.asyncHandler(
		async (req, res) => {
			const { _id, teamId } = req.user;
			const demoMonitors = await this.monitorService.addDemoMonitors({ userId: _id, teamId });

			return res.success({
				msg: this.stringService.monitorDemoAdded,
				data: demoMonitors?.length ?? 0,
			});
		},
		SERVICE_NAME,
		"addDemoMonitors"
	);

	sendTestEmail = this.asyncHandler(
		async (req, res) => {
			const { to } = req.body;
			if (!to || typeof to !== "string") {
				throw this.errorService.createBadRequestError(this.stringService.errorForValidEmailAddress);
			}

			const messageId = await this.monitorService.sendTestEmail({ to });
			return res.success({
				msg: this.stringService.sendTestEmail,
				data: { messageId },
			});
		},
		SERVICE_NAME,
		"sendTestEmail"
	);

	getMonitorsByTeamId = this.asyncHandler(
		async (req, res) => {
			await getMonitorsByTeamIdParamValidation.validateAsync(req.params);
			await getMonitorsByTeamIdQueryValidation.validateAsync(req.query);

			let { limit, type, page, rowsPerPage, filter, field, order } = req.query;
			const teamId = req?.user?.teamId;

			const monitors = await this.monitorService.getMonitorsByTeamId({ teamId, limit, type, page, rowsPerPage, filter, field, order });

			return res.success({
				msg: this.stringService.monitorGetByTeamId,
				data: monitors,
			});
		},
		SERVICE_NAME,
		"getMonitorsByTeamId"
	);

	getMonitorsAndSummaryByTeamId = this.asyncHandler(
		async (req, res) => {
			await getMonitorsByTeamIdParamValidation.validateAsync(req.params);
			await getMonitorsByTeamIdQueryValidation.validateAsync(req.query);

			const explain = req?.query?.explain;
			const type = req?.query?.type;
			const teamId = req?.user?.teamId;
			if (!teamId) {
				throw this.errorService.createBadRequestError("Team ID is required");
			}

			const result = await this.monitorService.getMonitorsAndSummaryByTeamId({ teamId, type, explain });

			return res.success({
				msg: "OK", // TODO
				data: result,
			});
		},
		SERVICE_NAME,
		"getMonitorsAndSummaryByTeamId"
	);

	getMonitorsWithChecksByTeamId = this.asyncHandler(
		async (req, res) => {
			await getMonitorsByTeamIdParamValidation.validateAsync(req.params);
			await getMonitorsByTeamIdQueryValidation.validateAsync(req.query);

			const explain = req?.query?.explain;
			let { limit, type, page, rowsPerPage, filter, field, order } = req.query;
			const teamId = req?.user?.teamId;
			if (!teamId) {
				throw this.errorService.createBadRequestError("Team ID is required");
			}

			const monitors = await this.monitorService.getMonitorsWithChecksByTeamId({
				teamId,
				limit,
				type,
				page,
				rowsPerPage,
				filter,
				field,
				order,
				explain,
			});

			return res.success({
				msg: "OK",
				data: monitors,
			});
		},
		SERVICE_NAME,
		"getMonitorsWithChecksByTeamId"
	);

	exportMonitorsToCSV = this.asyncHandler(
		async (req, res) => {
			const teamId = req?.user?.teamId;
			if (!teamId) {
				throw this.errorService.createBadRequestError("Team ID is required");
			}

			const csv = await this.monitorService.exportMonitorsToCSV({ teamId });

			return res.file({
				data: csv,
				headers: {
					"Content-Type": "text/csv",
					"Content-Disposition": "attachment; filename=monitors.csv",
				},
			});
		},
		SERVICE_NAME,
		"exportMonitorsToCSV"
	);

	getAllGames = this.asyncHandler(
		async (req, res) => {
			return res.success({
				msg: "OK",
				data: this.monitorService.getAllGames(),
			});
		},
		SERVICE_NAME,
		"getAllGames"
	);

	getGroupsByTeamId = this.asyncHandler(
		async (req, res) => {
			const teamId = req?.user?.teamId;
			if (!teamId) {
				throw this.errorService.createBadRequestError("Team ID is required");
			}

			const groups = await this.monitorService.getGroupsByTeamId({ teamId });

			return res.success({
				msg: "OK",
				data: groups,
			});
		},
		SERVICE_NAME,
		"getGroupsByTeamId"
	);
}

export default MonitorController;
