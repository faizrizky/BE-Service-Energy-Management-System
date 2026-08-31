const reportUseCase = require("../../application/use_cases/report/report.usecase");

async function dashboardSummary(req, res, next) {
  try {
    const summary = await reportUseCase.getDashboardSummary();
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
}

async function deviceUsage(req, res, next) {
  try {
    const range = req.query.range || "today";
    const usage = await reportUseCase.getDeviceUsage(req.params.id, range);
    res.json({ data: usage });
  } catch (err) {
    next(err);
  }
}

async function roomUsage(req, res, next) {
  try {
    const range = req.query.range || "today";
    const usage = await reportUseCase.getRoomUsage(req.params.id, range);
    res.json({ data: usage });
  } catch (err) {
    next(err);
  }
}

async function exportEnergy(req, res, next) {
  try {
    const { roomId, deviceId, from, to, format } = req.query;
    const rows = await reportUseCase.exportEnergyReport({
      roomId,
      deviceId,
      from,
      to,
    });
    const filename = `energy-report-${from}_to_${to}`;

    if (format === "csv") {
      const csv = reportUseCase.toCsv(rows);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.csv"`,
      );
      return res.send(csv);
    }

    if (format === "xlsx") {
      const xlsx = await reportUseCase.toXlsx(rows);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.xlsx"`,
      );
      return res.send(xlsx);
    }

    if (format === "pdf") {
      const pdf = await reportUseCase.toPdf(rows);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.pdf"`,
      );
      return res.send(pdf);
    }

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}
async function energyUsageTimeline(req, res, next) {
  try {
    const range = req.query.range || "today";
    const data = await reportUseCase.getEnergyUsageTimeline(range);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function topRiskyRooms(req, res, next) {
  try {
    const range = req.query.range || "today";
    const data = await reportUseCase.getTopRiskyRooms(range);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function activeSchedules(req, res, next) {
  try {
    const status = req.query.status || "active";
    const data = await reportUseCase.getActiveSchedules(status);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboardSummary,
  deviceUsage,
  roomUsage,
  exportEnergy,
  energyUsageTimeline,
  topRiskyRooms,
  activeSchedules,
};
