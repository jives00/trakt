import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { buildExcelExport } from '../services/excel-export.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

export async function excelExportRoutes(app: FastifyInstance) {
  app.get(
    '/export/excel',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const buffer = await buildExcelExport(userId(request));
      const filename = `trakt-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer);
    },
  );
}
