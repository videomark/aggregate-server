// eslint-disable-next-line import/no-unresolved
const createError = require("http-errors");
// eslint-disable-next-line import/no-unresolved
const express = require("express");
// eslint-disable-next-line import/no-unresolved
const cookieParser = require("cookie-parser");
// eslint-disable-next-line import/no-unresolved
const logger = require("morgan");
// eslint-disable-next-line import/no-unresolved
const config = require("config");
// eslint-disable-next-line import/no-unresolved
const { MongoWrapper, LocationFinder, ISPFinder } = require("qoe-lib");

const path = require("path");

const statsRouter = require("./routes/stats");
const statsServiceRouter = require("./routes/stats_service");
const statsCountryRouter = require("./routes/stats_country");
const statsSubdivisionRouter = require("./routes/stats_subdivision");
const statsISPRouter = require("./routes/stats_isp");
const statsInfoRouter = require("./routes/stats_info");
const statsActiveRouter = require("./routes/stats_active");
const ctrlErasureRouter = require("./routes/ctrl_erasure");

const app = express();

let mongodb;
let finder;

if (config.get("dummy")) {
  mongodb = null;
  finder = null;
} else {
  mongodb = new MongoWrapper(config.get("db.url"), config.get("db.name"));
  mongodb.open();
  finder = {
    location: new LocationFinder(config.get("file.city")),
    isp: new ISPFinder(config.get("file.ISP")),
  };
}

app.set("mongodb", mongodb);
app.set("finder", finder);

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/stats", statsRouter);
app.use("/stats/service", statsServiceRouter);
app.use("/stats/country", statsCountryRouter);
app.use("/stats/subdivision", statsSubdivisionRouter);
app.use("/stats/isp", statsISPRouter);
app.use("/stats/info", statsInfoRouter);
app.use("/stats/active", statsActiveRouter);
app.use("/ctrl/erasure", ctrlErasureRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
