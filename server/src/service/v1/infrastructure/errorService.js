export class AppError extends Error {
	constructor(message, status = 500, service = null, method = null, details = null) {
		super(message);
		this.status = status;
		this.service = service;
		this.method = method;
		this.details = details;

		Error.captureStackTrace(this, this.constructor);
	}
}

class ValidationError extends AppError {
	constructor(message, details = null, service = null, method = null) {
		super(message, 422, service, method, details);
	}
}

class AuthenticationError extends AppError {
	constructor(message, details = null, service = null, method = null) {
		super(message, 401, service, method, details);
	}
}

class AuthorizationError extends AppError {
	constructor(message, details = null, service = null, method = null) {
		super(message, 403, service, method, details);
	}
}

class NotFoundError extends AppError {
	constructor(message, details = null, service = null, method = null) {
		super(message, 404, service, method, details);
	}
}

class ConflictError extends AppError {
	constructor(message, details = null, service = null, method = null) {
		super(message, 409, service, method, details);
	}
}

class DatabaseError extends AppError {
	constructor(message, details = null, service = null, method = null) {
		super(message, 500, service, method, details);
	}
}

class BadRequestError extends AppError {
	constructor(message, details = null, service = null, method = null) {
		super(message, 400, service, method, details);
	}
}

const SERVICE_NAME = "ErrorService";
class ErrorService {
	static SERVICE_NAME = SERVICE_NAME;
	constructor() {}

	get serviceName() {
		return ErrorService.SERVICE_NAME;
	}

	createError = (message, status = 500, service = null, method = null, details = null) => {
		return new AppError(message, status, service, method, details);
	};

	// Unified createValidationError:
	// - if first arg is a Mongoose ValidationError object, return structured details
	// - otherwise create a ValidationError AppError
	createValidationError = (errOrMessage, details = null, service = null, method = null) => {
		// handle Mongoose ValidationError object
		if (errOrMessage && errOrMessage.name === "ValidationError" && errOrMessage.errors) {
			const extracted = Object.keys(errOrMessage.errors).map((key) => {
				const e = errOrMessage.errors[key];
				return { field: e.path || key, message: e.message };
			});
			console.error("Mongoose validation details:", JSON.stringify(extracted, null, 2));
			return {
				status: 400,
				message: "Database validation failed",
				data: extracted,
				original: errOrMessage,
			};
		}

		// handle string/message case (create ValidationError AppError)
		const msg = typeof errOrMessage === "string" ? errOrMessage : "Validation error";
		return new ValidationError(msg, details, service, method);
	};

	createAuthenticationError = (message = "Unauthorized", details = null, service = null, method = null) => {
		return new AuthenticationError(message, details, service, method);
	};

	createAuthorizationError = (message, details = null, service = null, method = null) => {
		return new AuthorizationError(message, details, service, method);
	};

	createNotFoundError = (message, details = null, service = null, method = null) => {
		return new NotFoundError(message, details, service, method);
	};

	createConflictError = (message, details = null, service = null, method = null) => {
		return new ConflictError(message, details, service, method);
	};

	createDatabaseError = (message, details = null, service = null, method = null) => {
		return new DatabaseError(message, details, service, method);
	};

	createServerError = (message, details = null, service = null, method = null) => {
		return this.createError(message, 500, service, method, details);
	};

	createBadRequestError = (message = "BadRequest", details = null, service = null, method = null) => {
		return new BadRequestError(message, details, service, method);
	};
}

export { ErrorService }; // add this so other modules can do: import { ErrorService } from '...'
export default new ErrorService();
