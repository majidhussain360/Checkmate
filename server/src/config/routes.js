// ...existing code...
import { verifyJWT } from "../middleware/v1/verifyJWT.js";
import { authApiLimiter } from "../middleware/v1/rateLimiter.js";

import AuthRoutes from "../routes/v1/authRoute.js";
import InviteRoutes from "../routes/v1//inviteRoute.js";
import MonitorRoutes from "../routes/v1/monitorRoute.js";
import CheckRoutes from "../routes/v1/checkRoute.js";
import SettingsRoutes from "../routes/v1/settingsRoute.js";
import MaintenanceWindowRoutes from "../routes/v1/maintenanceWindowRoute.js";
import StatusPageRoutes from "../routes/v1/statusPageRoute.js";
import QueueRoutes from "../routes/v1/queueRoute.js";
import LogRoutes from "../routes/v1/logRoutes.js";
import DiagnosticRoutes from "../routes/v1//diagnosticRoute.js";
import NotificationRoutes from "../routes/v1/notificationRoute.js";

//V2
import AuthRoutesV2 from "../routes/v2/auth.js";
import InviteRoutesV2 from "../routes/v2/invite.js";
import MaintenanceRoutesV2 from "../routes/v2/maintenance.js";
import MonitorRoutesV2 from "../routes/v2/monitors.js";
import NotificationChannelRoutesV2 from "../routes/v2/notificationChannels.js";
import QueueRoutesV2 from "../routes/v2/queue.js";

export const setupRoutes = (app, controllers) => {
	if (!controllers || typeof controllers !== "object") {
		throw new Error("controllers object is required when calling setupRoutes");
	}

	// required controller keys (fail fast if any are missing)
	const required = [
		"authController",
		"monitorController",
		"settingsController",
		"checkController",
		"inviteController",
		"maintenanceWindowController",
		"queueController",
		"logController",
		"statusPageController",
		"notificationController",
		"diagnosticController",
		// v2
		"authControllerV2",
		"inviteControllerV2",
		"maintenanceControllerV2",
		"monitorControllerV2",
		"notificationChannelControllerV2",
		"queueControllerV2",
	];

	const missing = required.filter((k) => !(k in controllers) || controllers[k] == null);
	if (missing.length) {
		console.error("setupRoutes: missing controllers:", missing);
		throw new Error("Missing controllers passed to setupRoutes: " + missing.join(", "));
	}

	// Helpful debug info for troubleshooting undefined handlers
	console.log("setupRoutes: controllers keys:", Object.keys(controllers));
	console.log("checkController.getChecksByMonitor:", typeof controllers.checkController.getChecksByMonitor);
	console.log("checkController.getChecksByTeam:", typeof controllers.checkController.getChecksByTeam);
	console.log("monitorController handlers exist:", typeof controllers.monitorController.getMonitors);

	// Helper to construct route instances and fail with context if something's wrong
	const constructRoute = (RouteClass, controller, name) => {
		try {
			const instance = new RouteClass(controller);
			if (!instance || typeof instance.getRouter !== "function") {
				throw new Error(`${name}: constructed instance missing getRouter()`);
			}
			return instance;
		} catch (err) {
			console.error(`Failed to initialize ${name}:`, err);
			throw err;
		}
	};

	// V1
	const authRoutes = constructRoute(AuthRoutes, controllers.authController, "AuthRoutes");
	const monitorRoutes = constructRoute(MonitorRoutes, controllers.monitorController, "MonitorRoutes");
	const settingsRoutes = constructRoute(SettingsRoutes, controllers.settingsController, "SettingsRoutes");
	const checkRoutes = constructRoute(CheckRoutes, controllers.checkController, "CheckRoutes");
	const inviteRoutes = constructRoute(InviteRoutes, controllers.inviteController, "InviteRoutes");
	const maintenanceWindowRoutes = constructRoute(MaintenanceWindowRoutes, controllers.maintenanceWindowController, "MaintenanceWindowRoutes");
	const queueRoutes = constructRoute(QueueRoutes, controllers.queueController, "QueueRoutes");
	const logRoutes = constructRoute(LogRoutes, controllers.logController, "LogRoutes");
	const statusPageRoutes = constructRoute(StatusPageRoutes, controllers.statusPageController, "StatusPageRoutes");
	const notificationRoutes = constructRoute(NotificationRoutes, controllers.notificationController, "NotificationRoutes");
	const diagnosticRoutes = constructRoute(DiagnosticRoutes, controllers.diagnosticController, "DiagnosticRoutes");

	// Register V1 routes
	app.use("/api/v1/auth", authApiLimiter, authRoutes.getRouter());
	app.use("/api/v1/monitors", verifyJWT, monitorRoutes.getRouter());
	app.use("/api/v1/settings", verifyJWT, settingsRoutes.getRouter());
	app.use("/api/v1/checks", verifyJWT, checkRoutes.getRouter());
	app.use("/api/v1/invite", inviteRoutes.getRouter());
	app.use("/api/v1/maintenance-window", verifyJWT, maintenanceWindowRoutes.getRouter());
	app.use("/api/v1/queue", verifyJWT, queueRoutes.getRouter());
	app.use("/api/v1/logs", verifyJWT, logRoutes.getRouter());
	app.use("/api/v1/status-page", statusPageRoutes.getRouter());
	app.use("/api/v1/notifications", verifyJWT, notificationRoutes.getRouter());
	app.use("/api/v1/diagnostic", verifyJWT, diagnosticRoutes.getRouter());

	// V2
	const authRoutesV2 = constructRoute(AuthRoutesV2, controllers.authControllerV2, "AuthRoutesV2");
	const inviteRoutesV2 = constructRoute(InviteRoutesV2, controllers.inviteControllerV2, "InviteRoutesV2");
	const maintenanceRoutesV2 = constructRoute(MaintenanceRoutesV2, controllers.maintenanceControllerV2, "MaintenanceRoutesV2");
	const monitorRoutesV2 = constructRoute(MonitorRoutesV2, controllers.monitorControllerV2, "MonitorRoutesV2");
	const notificationChannelRoutesV2 = constructRoute(
		NotificationChannelRoutesV2,
		controllers.notificationChannelControllerV2,
		"NotificationChannelRoutesV2"
	);
	const queueRoutesV2 = constructRoute(QueueRoutesV2, controllers.queueControllerV2, "QueueRoutesV2");

	app.use("/api/v2/auth", authApiLimiter, authRoutesV2.getRouter());
	app.use("/api/v2/invite", inviteRoutesV2.getRouter());
	app.use("/api/v2/maintenance", maintenanceRoutesV2.getRouter());
	app.use("/api/v2/monitors", monitorRoutesV2.getRouter());
	app.use("/api/v2/notification-channels", notificationChannelRoutesV2.getRouter());
	app.use("/api/v2/queue", queueRoutesV2.getRouter());
};
// ...existing code...
