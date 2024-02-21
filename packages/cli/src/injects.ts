// set default log level before any other imports, directly on ESBuild

process.env.LOG_LEVEL ||= 'error';
