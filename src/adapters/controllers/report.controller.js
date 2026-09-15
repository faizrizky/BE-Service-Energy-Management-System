const reportUseCase = require("../../application/use_cases/report/report.usecase");

/**
 * Handler ringkasan dashboard: energi hari ini vs kemarin, jumlah gateway &
 * device online/offline.
 *
 * Dipake di:
 * - dashboard.routes.js → GET /api/dashboard/summary
 * - Frontend: dashboardApi.getSummary (halaman Dashboard & Report).
 */
async function dashboardSummary(req, res, next) {
  try {
    const summary = await reportUseCase.getDashboardSummary();
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler pemakaian energi satu device buat range today/week/month (default
 * today).
 *
 * Dipake di:
 * - report.routes.js → GET /api/reports/devices/:id/usage
 * - Frontend: belom dipanggil.
 */
async function deviceUsage(req, res, next) {
  try {
    const range = req.query.range || "today";
    const usage = await reportUseCase.getDeviceUsage(req.params.id, range);
    res.json({ data: usage });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler pemakaian energi tiap device di satu room buat range
 * today/week/month.
 *
 * Dipake di:
 * - report.routes.js → GET /api/reports/rooms/:id/usage
 * - Frontend: belom dipanggil.
 */
async function roomUsage(req, res, next) {
  try {
    const range = req.query.range || "today";
    const usage = await reportUseCase.getRoomUsage(req.params.id, range);
    res.json({ data: usage });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler tabel laporan: pemakaian per device (selisih meter) dengan filter
 * room/device & tanggal from–to.
 *
 * Dipake di:
 * - report.routes.js → GET /api/reports/summary
 * - Frontend: reportApi.getSummary (report/page.tsx),
 *   reportClientApi.getSummary (report/client.tsx).
 */
async function reportSummary(req, res, next) {
  try {
    const { roomId, deviceId, from, to } = req.query;
    const rows = await reportUseCase.getReportSummary({
      roomId,
      deviceId,
      from,
      to,
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler export reading energi jadi file CSV, XLSX, atau PDF. Kalo format
 * nggak diisi, bales JSON aja.
 *
 * Dipake di:
 * - report.routes.js → GET /api/reports/export
 * - Frontend: reportClientApi.export (tombol export di halaman Report).
 */
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

/**
 * Handler data grafik energi per jam/hari/bulan buat range today, last_week,
 * last_month, last_year.
 *
 * Dipake di:
 * - dashboard.routes.js → GET /api/dashboard/energy-usage-timeline
 * - Frontend: dashboardApi.getEnergyUsageTimeline (halaman Dashboard &
 *   Report).
 */
async function energyUsageTimeline(req, res, next) {
  try {
    const range = req.query.range || "today";
    const data = await reportUseCase.getEnergyUsageTimeline(range);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler 5 room yang pemakaian energinya paling gede di range tertentu.
 *
 * Dipake di:
 * - dashboard.routes.js → GET /api/dashboard/top-risky-rooms
 * - Frontend: dashboardApi.getTopRiskyRooms (halaman Dashboard).
 */
async function topRiskyRooms(req, res, next) {
  try {
    const range = req.query.range || "today";
    const data = await reportUseCase.getTopRiskyRooms(range);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler list schedule yang lagi aktif atau yang bakal jalan, buat kartu di
 * dashboard.
 *
 * Dipake di:
 * - dashboard.routes.js → GET /api/dashboard/schedules
 * - Frontend: dashboardApi.getActiveSchedules (halaman Dashboard).
 */
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
  reportSummary,
  energyUsageTimeline,
  topRiskyRooms,
  activeSchedules,
};
