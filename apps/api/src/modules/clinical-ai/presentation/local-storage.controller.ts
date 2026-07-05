import {
  BadRequestException,
  Controller,
  Get,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LocalDiskStorageAdapter } from '../infrastructure/local-disk-storage.adapter';

/**
 * Dev-only HTTP surface that makes `LocalDiskStorageAdapter`'s signed
 * URLs actually resolve to something — a real Supabase Storage adapter
 * wouldn't need this controller at all, since its signed URL would
 * point directly at Supabase, not back at this API. Delete this file
 * (and swap the DI registration in clinical-ai.module.ts) when wiring
 * in real Supabase Storage — see docs/adr/0007.
 *
 * Requires `express.raw()` mounted for this path in main.ts so
 * `req.body` is the raw chunk bytes, not JSON-parsed.
 */
@Controller('clinical-ai/storage/objects')
export class LocalStorageController {
  constructor(private readonly storage: LocalDiskStorageAdapter) {}

  @Put()
  async upload(
    @Query('token') token: string,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    if (!token) throw new BadRequestException('Missing storage token.');
    const storageKey = this.storage.verifyToken(token, 'upload');

    const body: unknown = req.body;
    if (!Buffer.isBuffer(body)) {
      throw new BadRequestException('Expected a raw binary request body.');
    }
    await this.storage.writeObject(storageKey, body);
    return { ok: true };
  }

  @Get()
  async read(
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!token) throw new BadRequestException('Missing storage token.');
    const storageKey = this.storage.verifyToken(token, 'read');
    const data = await this.storage.readObject(storageKey);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(data);
  }
}
