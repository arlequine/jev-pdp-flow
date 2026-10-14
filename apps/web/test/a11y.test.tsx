import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SizeGuide } from '../src/features/pdp/SizeGuide';
import { StockBadge } from '../src/features/pdp/StockBadge';

afterEach(cleanup);

describe('accesibilidad (PDP-142.7)', () => {
  it('la guía de tallas es un diálogo con foco en "Cerrar" y se cierra con Escape', () => {
    let closed = false;
    render(<SizeGuide sizes={['S', 'M']} onClose={() => (closed = true)} />);
    expect(screen.getByRole('dialog', { name: 'Guía de tallas' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar guía de tallas' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closed).toBe(true);
  });

  it('el stock se anuncia a lectores de pantalla', () => {
    render(<StockBadge stock={0} />);
    expect(screen.getByRole('status').textContent).toBe('Agotado en esta combinación');
  });
});
