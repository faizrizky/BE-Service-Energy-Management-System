const { prisma } = require("../../../frameworks/database/prismaClient");
const { httpError } = require("../../../frameworks/helpers/httpError");
const {  emitScheduleCard } = require("../../../frameworks/webserver/socket-events");

async function cardSchedule(data) {
    const schedules = await prisma.schedule.findMany({
        select: {
        id: true,
        name: true,
        status: true
        }
    });

    const totalData = schedules.length;

    const totalActive = schedules.filter(
        (schedule) => schedule.status === "active"
    ).length;

    const totalUpcoming = schedules.filter(
        (schedule) => schedule.status === "upcoming"
    ).length;

    const result = {
        data: {totalData, totalActive, totalUpcoming}
    };

    emitScheduleCard(result?.data)
    return result
}

module.exports = {
    cardSchedule
}