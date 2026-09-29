import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import { CatalogItem, PageResult, WorkApiService } from '../core/work-api.service';
import { CatalogLivePage } from './catalog-page';

describe('CatalogLivePage (Services and parts price book)', () => {
  const mockItems: CatalogItem[] = [
    { id: 'cat-1', itemType: 'Service', name: 'Standard Service Call', unit: 'each', unitCost: 30, unitPrice: 95, taxCategory: '', isArchived: false },
    { id: 'cat-2', itemType: 'Part', name: 'Brass Ball Valve', unit: 'each', unitCost: 15, unitPrice: 42, taxCategory: 'TX-TAXABLE', isArchived: false }
  ];

  let page: CatalogLivePage;
  let api: {
    catalog: ReturnType<typeof vi.fn>;
    createCatalogItem: ReturnType<typeof vi.fn>;
    updateCatalogItem: ReturnType<typeof vi.fn>;
    deleteCatalogItem: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      catalog: vi.fn(() => of({ items: [...mockItems], total: mockItems.length, page: 1, pageSize: 50 } as PageResult<CatalogItem>)),
      createCatalogItem: vi.fn((cmd: any) => of({ id: 'cat-new', ...cmd, isArchived: false })),
      updateCatalogItem: vi.fn((id: string, cmd: any) => of({ id, ...cmd, isArchived: false })),
      deleteCatalogItem: vi.fn((_id: string) => of(undefined))
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: WorkApiService, useValue: api }
      ]
    });

    page = TestBed.runInInjectionContext(() => new CatalogLivePage());
  });

  it('loads catalog items and calculates counts and average price', () => {
    expect(page.items().length).toBe(2);
    expect(page.count('Service')).toBe(1);
    expect(page.count('Part')).toBe(1);
    expect(page.average()).toBe((95 + 42) / 2);
  });

  it('populates model and calls updateCatalogItem when editing an existing item', () => {
    const item = mockItems[0];
    page.editingItem.set(item);
    page.model = {
      itemType: item.itemType,
      name: 'Diagnostic & Service Call',
      unit: item.unit,
      unitCost: item.unitCost,
      unitPrice: 110,
      taxCategory: item.taxCategory || ''
    };

    page.save();

    expect(api.updateCatalogItem).toHaveBeenCalledWith(item.id, {
      itemType: 'Service',
      name: 'Diagnostic & Service Call',
      unit: 'each',
      unitCost: 30,
      unitPrice: 110,
      taxCategory: ''
    });
    expect(api.createCatalogItem).not.toHaveBeenCalled();
  });

  it('calls deleteCatalogItem when delete is confirmed', () => {
    const item = mockItems[1];
    page.deletingItem.set(item);

    page.confirmDelete();

    expect(api.deleteCatalogItem).toHaveBeenCalledWith(item.id);
    expect(api.catalog).toHaveBeenCalledTimes(2); // Initial load + reload after delete
  });

  it('handles delete failure gracefully and surfaces the error message', () => {
    api.deleteCatalogItem.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { detail: 'Cannot delete item.' } })));
    const item = mockItems[1];
    page.deletingItem.set(item);

    page.confirmDelete();

    expect(page.error()).toBe('Cannot delete item.');
    expect(page.saving()).toBe(false);
  });
});
