const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const chalk = require('chalk');
const os = require('os');
const { ArtifactManager } = require('./src/utils/ArtifactManager.js');

const routes = require('./src/routes/index.js');
const { rateLimiter } = require('./src/middleware/rateLimiter.js');
const { compression } = require('./src/middleware/compression.js');
const { errorHandler } = require('./src/middleware/errorHandler.js');
const { swaggerSpec } = require('./src/config/swagger.js');
const { initializeApiClients } = require('./src/utils/apiClientInitializer.js');
const { initializeUserPreferences } = require('./src/utils/userPreferencesManager.js');

dotenv.config();

const app = express();

// Middleware
app.set('trust proxy', 1);
app.use(rateLimiter);
app.use(cors());
app.use(compression);
app.use(express.json());

// Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

const artifactManager = new ArtifactManager();

async function startServer() {
  await initializeUserPreferences();
  await initializeApiClients();

  console.log(chalk.blue(`
                  Welcome to ArtyLLaMa!
              Say hello contact@artyllama.com
 Report bugs to https://github.com/kroonen/ArtyLLaMa/issues
`));

  console.log(chalk.cyan("ArtyLLaMa Server Starting..."));

  const PORT = process.env.PORT || 3001;
  const HOST = '0.0.0.0';

  const server = app.listen(PORT, HOST, () => {
    console.log(chalk.green(`Server running on http://${HOST}:${PORT}`));
    console.log(chalk.yellow(`Local access: http://localhost:${PORT}`));
    console.log(chalk.blue(`Swagger UI available at http://localhost:${PORT}/api-docs`));

    const networkInterfaces = os.networkInterfaces();
    Object.keys(networkInterfaces).forEach((interfaceName) => {
      const interfaces = networkInterfaces[interfaceName];
      interfaces.forEach((iface) => {
        if (iface.family === "IPv4" && !iface.internal) {
          console.log(chalk.cyan(`Network access (${interfaceName}): http://${iface.address}:${PORT}`));
          console.log(chalk.magenta(`Swagger UI network access (${interfaceName}): http://${iface.address}:${PORT}/api-docs`));
        }
      });
    });
  });

  server.timeout = 120000; // Set to 2 minutes (120,000 ms)

  process.on('exit', () => {
    console.log(chalk.yellow("Generating session summary..."));
    artifactManager.generateSessionSummary();
    console.log(chalk.green("Session summary generated. Goodbye!"));
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red("Unhandled Rejection at:"), promise, chalk.red("reason:"), reason);
  });

  process.on('uncaughtException', (error) => {
    console.error(chalk.red("Uncaught Exception:"), error);
    process.exit(1);
  });
}

startServer().catch(console.error);
