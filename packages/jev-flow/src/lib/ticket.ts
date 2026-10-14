import { existsSync, readFileSync } from 'node:fs';
import { Ticket, TicketTruth } from '@jev/contracts';
import { path } from '../config';

export function loadTicket(id: string): Ticket {
  const f = path('tickets', `${id}.json`);
  if (!existsSync(f)) throw new Error(`No existe tickets/${id}.json`);
  return Ticket.parse(JSON.parse(readFileSync(f, 'utf8')));
}

export function loadTruth(id: string): TicketTruth | null {
  const f = path('tickets', `${id}.truth.json`);
  return existsSync(f) ? TicketTruth.parse(JSON.parse(readFileSync(f, 'utf8'))) : null;
}

export const loadTicketMarkdown = (id: string) => readFileSync(path('tickets', `${id}.md`), 'utf8');
