// Logger Utility using Winston
import { createLogger, format, transports } from "winston";
import { v4 as uuidv4 } from "uuid";

const isVercel = Boolean(process.env.VERCEL);
const loggerTransports = [
  new transports.Console({
    format: format.combine(
      format.colorize(),
      format.printf(
        ({ timestamp, level, message, ...meta }) => {
          const metaString = Object.keys(meta).length
            ? JSON.stringify(meta, null, 2)
            : "";
          return `[${timestamp}] ${level}: ${message} ${metaString}`;
        }
      )
    )
  })
];
if (!isVercel) {
  loggerTransports.push(
    new transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 5242880,
      maxFiles: 5
    }),
    new transports.File({
      filename: "logs/combined.log",
      maxsize: 5242880,
      maxFiles: 5
    })
  );
}

// Create a logger instance
const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "scuola-interattiva-api" },
  transports: loggerTransports,
  exitOnError: false, // Don't exit on handled exceptions
});

// Middleware to add request ID and log requests
export const requestLogger = (req, res, next) => {
  const requestId = uuidv4();
  req.id = requestId;
  
  const startTime = Date.now();
  
  // Log incoming request
  logger.info("Incoming request", {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("User-Agent"),
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined
  });
  
  // Log response when it's finished
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    logger.info("Request completed", {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user ? req.user.id : undefined
    });
  });
  
  // Log response when there's an error
  res.on("close", () => {
    const duration = Date.now() - startTime;
    if (!res.headersSent) {
      logger.warn("Request closed before response sent", {
        requestId,
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`
      });
    }
  });
  
  next();
};

// Error logging middleware
export const errorLogger = (error, req, res, next) => {
  logger.error("Request error", {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    error: error.message,
    stack: error.stack,
    userId: req.user ? req.user.id : undefined
  });
  next(error);
};

// Utility functions for logging specific events
export const logDatabaseQuery = (query, params, duration) => {
  logger.debug("Database query executed", {
    query,
    params,
    duration: `${duration}ms`
  });
};

export const logAIRequest = (prompt, model, duration) => {
  logger.info("AI request processed", {
    promptLength: prompt.length,
    model,
    duration: `${duration}ms`
  });
};

export const logFileUpload = (userId, fileCount, subjectId) => {
  logger.info("File upload processed", {
    userId,
    fileCount,
    subjectId
  });
};

export const logQuestionAsked = (userId, subjectId, questionLength) => {
  logger.info("Question asked", {
    userId,
    subjectId,
    questionLength
  });
};

export default logger;
