import { CurrencyPipe } from '@angular/common';
import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NgSelectComponent } from '@ng-select/ng-select';
import { CatalogItem, WorkApiService } from '../core/work-api.service';
import { CATALOG_UNITS } from '../core/reference-data';

@Component({
  selector: 'app-catalog-live',
  styles: `
.catalog-dialog, .delete-dialog { width:min(600px,calc(100vw - 32px)); max-height:calc(100dvh - 32px); padding:0; border:1px solid var(--line); border-radius:5px; background:white; color:var(--ink); box-shadow:0 24px 80px #10293640; overflow:hidden; }
.delete-dialog { width:min(480px,calc(100vw - 32px)); }
.catalog-dialog[open], .delete-dialog[open] { display:flex; flex-direction:column; }
.catalog-dialog::backdrop, .delete-dialog::backdrop { background:rgb(16 41 54 / 55%); backdrop-filter:blur(2px); }
.catalog-dialog-header { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:20px 24px; border-bottom:1px solid var(--line); flex-shrink:0; }
.catalog-dialog-header h2 { margin:0; font-size:20px; }
.catalog-dialog-header p { margin:6px 0 0; color:var(--muted); font-size:13px; }
.catalog-dialog-body { padding:24px; margin:0; overflow-y:auto; min-height:0; overscroll-behavior:contain; }
.catalog-dialog-footer { display:flex; justify-content:flex-end; gap:12px; padding:16px 24px; border-top:1px solid var(--line); flex-shrink:0; background:#f8fafb; }
.catalog-dialog .btn, .catalog-dialog .icon-btn, .delete-dialog .btn, .delete-dialog .icon-btn { min-height:44px; }
@media(max-width:600px) { .catalog-dialog-header,.catalog-dialog-body { padding:18px; } .catalog-dialog-body { grid-template-columns:minmax(0,1fr); } .catalog-dialog-footer { padding:14px 18px; } .catalog-dialog-footer .btn { flex:1; justify-content:center; } }
.page-head { display:flex !important; flex-direction:row !important; align-items:flex-start !important; justify-content:space-between !important; gap:12px !important; }
.page-head > .btn { width:auto !important; flex-shrink:0 !important; white-space:nowrap !important; align-self:flex-start !important; }

.action-btn { padding: 6px 12px; border-radius: 5px; font-size: 12px; font-weight: 600; border: 1px solid var(--line); background: #fff; color: var(--ink); cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 5px; }
.action-btn:hover { border-color: var(--teal); color: var(--teal); background: #f0fdfa; }
.action-btn.danger { color: var(--red); border-color: #ffd0d0; }
.action-btn.danger:hover { background: var(--red-bg); border-color: var(--red); }
.action-cell { text-align: right; white-space: nowrap; }
`,
  imports: [FormsModule, CurrencyPipe, NgSelectComponent],
  template: `
<main class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Price book</p>
      <h1>Services & parts</h1>
      <p>Reusable items keep jobs, estimates, and invoices consistent.</p>
    </div>
    <button class="btn primary" id="open-add-item-btn" (click)="openCreateForm()">＋ Add item</button>
  </header>

  <section class="grid cols-4">
    <article class="card stat">
      <span class="stat-label">Active items</span>
      <strong class="stat-value">{{items().length}}</strong>
      <span class="stat-meta">In your price book</span>
    </article>
    <article class="card stat">
      <span class="stat-label">Services</span>
      <strong class="stat-value">{{count('Service')}}</strong>
      <span class="stat-meta">Reusable work</span>
    </article>
    <article class="card stat">
      <span class="stat-label">Parts</span>
      <strong class="stat-value">{{count('Part')}}</strong>
      <span class="stat-meta">Materials and parts</span>
    </article>
    <article class="card stat">
      <span class="stat-label">Average price</span>
      <strong class="stat-value">{{average()|currency}}</strong>
      <span class="stat-meta">Across active items</span>
    </article>
  </section>

  <!-- Add / Edit Catalog Item Dialog -->
  <dialog #itemDialog class="catalog-dialog" aria-labelledby="catalog-dialog-title" (cancel)="cancelDialog($event)" (close)="showForm.set(false)">
    <div class="catalog-dialog-header">
      <div>
        <h2 id="catalog-dialog-title">{{editingItem() ? 'Edit catalog item' : 'Add catalog item'}}</h2>
        <p>{{editingItem() ? 'Update price book details. Changes apply to future jobs and estimates.' : 'Save a reusable service or part to your price book.'}}</p>
      </div>
      <button type="button" class="icon-btn" aria-label="Close catalog item modal" [disabled]="saving()" (click)="closeForm()">×</button>
    </div>
    <form id="catalog-item-form" class="catalog-dialog-body form-grid" (ngSubmit)="save()" novalidate>
      <div class="field">
        <label for="itemType">Type *</label>
        <ng-select id="itemType" name="itemType" [items]="itemTypeOptions" bindLabel="label" bindValue="value" [(ngModel)]="model.itemType" [searchable]="false" [clearable]="false"></ng-select>
      </div>
      <div class="field" [class.has-error]="hasError('name')">
        <label for="name">Name *</label>
        <input id="name" name="name" autofocus [(ngModel)]="model.name" (blur)="markTouched('name')" (input)="onInput('name')" placeholder="Standard Service Call">
        @if(hasError('name')){<span class="field-error" id="catalog-name-error">{{errorMessage('name')}}</span>}
      </div>
      <div class="field" [class.has-error]="hasError('unit')">
        <label for="unit">Unit *</label>
        <ng-select id="unit" name="unit" [items]="catalogUnits" bindLabel="label" bindValue="value" [addTag]="addUnitTag" [(ngModel)]="model.unit" (change)="onUnitChange($event)" [placeholder]="model.unit ? '' : 'Select unit...'"></ng-select>
        @if(hasError('unit')){<span class="field-error" id="catalog-unit-error">{{errorMessage('unit')}}</span>}
      </div>
      <div class="field" [class.has-error]="hasError('unitCost')">
        <label for="unitCost">Cost</label>
        <input id="unitCost" name="unitCost" type="number" min="0" step=".01" [(ngModel)]="model.unitCost" (blur)="markTouched('unitCost')" (input)="onInput('unitCost')">
        @if(hasError('unitCost')){<span class="field-error" id="catalog-cost-error">{{errorMessage('unitCost')}}</span>}
      </div>
      <div class="field" [class.has-error]="hasError('unitPrice')">
        <label for="unitPrice">Sale price *</label>
        <input id="unitPrice" name="unitPrice" type="number" min="0" step=".01" [(ngModel)]="model.unitPrice" (blur)="markTouched('unitPrice')" (input)="onInput('unitPrice')">
        @if(hasError('unitPrice')){<span class="field-error" id="catalog-price-error">{{errorMessage('unitPrice')}}</span>}
      </div>
      <div class="field">
        <label for="taxCategory">Tax category</label>
        <ng-select id="taxCategory" name="taxCategory" [items]="taxOptions" bindLabel="label" bindValue="value" [(ngModel)]="model.taxCategory" [searchable]="false" [clearable]="true"></ng-select>
      </div>
      @if(error()){<div class="wide callout error-text" id="catalog-form-error">{{error()}}</div>}
    </form>
    <footer class="catalog-dialog-footer">
      <button class="btn" type="button" [disabled]="saving()" (click)="closeForm()">Cancel</button>
      <button class="btn primary" form="catalog-item-form" type="submit" [disabled]="saving()" id="save-catalog-btn">{{saving() ? 'Saving…' : (editingItem() ? 'Save changes' : 'Save item')}}</button>
    </footer>
  </dialog>

  <!-- Delete Confirmation Dialog -->
  <dialog #deleteDialog class="delete-dialog" aria-labelledby="delete-dialog-title" (cancel)="closeDeleteDialog()">
    <div class="catalog-dialog-header">
      <div>
        <h2 id="delete-dialog-title">Delete catalog item?</h2>
        <p>Remove this item from future price book selections.</p>
      </div>
      <button type="button" class="icon-btn" aria-label="Close delete dialog" [disabled]="saving()" (click)="closeDeleteDialog()">×</button>
    </div>
    <div class="catalog-dialog-body" style="padding: 20px 24px;">
      <p style="margin: 0 0 14px; font-size: 14px; line-height: 1.5;">
        Are you sure you want to remove <strong>{{deletingItem()?.name}}</strong> from your price book?
      </p>
      <div class="callout" style="margin: 0; font-size: 12.5px; line-height: 1.5;">
        <strong>Safe deletion:</strong> Past jobs, estimates, and invoices that used this item are preserved with their original line items, descriptions, and pricing untouched.
      </div>
    </div>
    <footer class="catalog-dialog-footer">
      <button class="btn" type="button" [disabled]="saving()" (click)="closeDeleteDialog()">Cancel</button>
      <button class="btn danger" type="button" [disabled]="saving()" (click)="confirmDelete()" id="confirm-delete-catalog-btn">{{saving() ? 'Deleting…' : 'Delete item'}}</button>
    </footer>
  </dialog>

  <!-- Price Book Table -->
  <section class="card section-gap">
    <div class="toolbar">
      <div class="search">
        <input placeholder="Search service or part" [(ngModel)]="search" (ngModelChange)="load()">
      </div>
      <ng-select class="filter-ng-select" [items]="typeFilterOptions" bindLabel="label" bindValue="value" [(ngModel)]="type" (ngModelChange)="load()" [searchable]="false" [clearable]="false" aria-label="Catalog item type"></ng-select>
    </div>

    @if(loading()){
      <div class="card-body muted">Loading catalog…</div>
    }@else if(error() && !showForm()){
      <div class="card-body callout error-text">{{error()}}</div>
    }@else{
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Type</th>
              <th>Unit</th>
              <th>Cost</th>
              <th>Sale price</th>
              <th>Tax</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for(i of items(); track i.id){
              <tr>
                <td><strong>{{i.name}}</strong></td>
                <td><span class="badge" [class.blue]="i.itemType==='Part'">{{i.itemType}}</span></td>
                <td>{{i.unit}}</td>
                <td>{{i.unitCost|currency}}</td>
                <td class="money">{{i.unitPrice|currency}}</td>
                <td>{{formatTax(i.taxCategory)}}</td>
                <td class="action-cell">
                  <div style="display: flex; gap: 6px; justify-content: flex-end;">
                    <button type="button" class="action-btn" (click)="openEditForm(i)" [attr.aria-label]="'Edit ' + i.name" id="edit-catalog-{{i.id}}">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      Edit
                    </button>
                    <button type="button" class="action-btn danger" (click)="promptDelete(i)" [attr.aria-label]="'Delete ' + i.name" id="delete-catalog-{{i.id}}">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  </section>
</main>
`
})
export class CatalogLivePage {
  @ViewChild('itemDialog') private itemDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('deleteDialog') private deleteDialog!: ElementRef<HTMLDialogElement>;
  private api = inject(WorkApiService);
  items = signal<CatalogItem[]>([]);
  loading = signal(true);
  saving = signal(false);
  showForm = signal(false);
  editingItem = signal<CatalogItem | null>(null);
  deletingItem = signal<CatalogItem | null>(null);
  error = signal('');
  search = '';
  type = '';

  readonly itemTypeOptions = [
    { value: 'Service', label: 'Service' },
    { value: 'Labor', label: 'Labor' },
    { value: 'Part', label: 'Part' }
  ];
  readonly typeFilterOptions = [
    { value: '', label: 'All item types' },
    { value: 'Service', label: 'Service' },
    { value: 'Labor', label: 'Labor' },
    { value: 'Part', label: 'Part' }
  ];
  readonly taxOptions = [
    { value: '', label: 'Non-taxable' },
    { value: 'TX-TAXABLE', label: 'TX-TAXABLE' }
  ];
  readonly catalogUnits = CATALOG_UNITS;
  submitted = signal(false);
  touched = signal<Record<string, boolean>>({});
  errors = signal<Record<string, string>>({});
  model = { itemType: 'Service', name: '', unit: 'each', unitCost: 0, unitPrice: 0, taxCategory: '' };

  constructor() {
    this.load();
  }

  openCreateForm() {
    this.editingItem.set(null);
    this.model = { itemType: 'Service', name: '', unit: 'each', unitCost: 0, unitPrice: 0, taxCategory: '' };
    this.showForm.set(true);
    this.submitted.set(false);
    this.touched.set({});
    this.errors.set({});
    this.error.set('');
    this.itemDialog?.nativeElement?.showModal();
  }

  openEditForm(item: CatalogItem) {
    this.editingItem.set(item);
    this.model = {
      itemType: item.itemType,
      name: item.name,
      unit: item.unit,
      unitCost: item.unitCost,
      unitPrice: item.unitPrice,
      taxCategory: item.taxCategory || ''
    };
    this.showForm.set(true);
    this.submitted.set(false);
    this.touched.set({});
    this.errors.set({});
    this.error.set('');
    this.itemDialog?.nativeElement?.showModal();
  }

  closeForm() {
    if (this.saving()) return;
    this.itemDialog?.nativeElement?.close();
    this.showForm.set(false);
    this.editingItem.set(null);
  }

  cancelDialog(event: Event) {
    event.preventDefault();
    this.closeForm();
  }

  promptDelete(item: CatalogItem) {
    this.deletingItem.set(item);
    this.deleteDialog?.nativeElement?.showModal();
  }

  closeDeleteDialog() {
    if (this.saving()) return;
    this.deleteDialog?.nativeElement?.close();
    this.deletingItem.set(null);
  }

  confirmDelete() {
    const item = this.deletingItem();
    if (!item || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.api.deleteCatalogItem(item.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDeleteDialog();
        this.load();
      },
      error: (e) => {
        this.error.set(this.message(e));
        this.saving.set(false);
      }
    });
  }

  addUnitTag = (tag: string) => {
    const trimmed = tag.trim();
    return { value: trimmed, code: trimmed, label: trimmed };
  };

  onUnitChange(val: any): void {
    if (val && typeof val === 'object') {
      this.model.unit = val.value || val.code || val.label || 'each';
    } else if (typeof val === 'string') {
      this.model.unit = val;
    }
    this.markTouched('unit');
  }

  load() {
    this.loading.set(true);
    this.api.catalog(this.search, this.type).subscribe({
      next: (r) => {
        this.items.set(r.items);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(this.message(e));
        this.loading.set(false);
      }
    });
  }

  private getUnitString(): string {
    if (!this.model.unit) return '';
    if (typeof this.model.unit === 'object') {
      return (this.model.unit as any).value || (this.model.unit as any).code || (this.model.unit as any).label || '';
    }
    return String(this.model.unit);
  }

  validateField(field: string): string {
    if (field === 'name' && !this.model.name?.trim()) return 'Item name is required.';
    if (field === 'unit' && !this.getUnitString().trim()) return 'Unit is required.';
    if (field === 'unitCost' && (this.model.unitCost === null || this.model.unitCost === undefined || this.model.unitCost < 0)) return 'Cost cannot be negative.';
    if (field === 'unitPrice' && (this.model.unitPrice === null || this.model.unitPrice === undefined || this.model.unitPrice < 0)) return 'Sale price cannot be negative.';
    return '';
  }

  runValidation(): boolean {
    const errs: Record<string, string> = {};
    for (const f of ['name', 'unit', 'unitCost', 'unitPrice']) {
      const msg = this.validateField(f);
      if (msg) errs[f] = msg;
    }
    this.errors.set(errs);
    return Object.keys(errs).length === 0;
  }

  markTouched(field: string): void {
    this.touched.update((t) => ({ ...t, [field]: true }));
    this.runValidation();
  }

  onInput(field: string): void {
    if (this.submitted() || this.touched()[field]) {
      this.runValidation();
    }
  }

  hasError(field: string): boolean {
    return (this.submitted() || !!this.touched()[field]) && !!this.errors()[field];
  }

  errorMessage(field: string): string {
    return this.hasError(field) ? (this.errors()[field] || '') : '';
  }

  save() {
    if (this.saving()) return;
    this.submitted.set(true);
    this.model.unit = this.getUnitString() || 'each';
    if (!this.runValidation()) return;
    this.saving.set(true);
    this.error.set('');

    const editing = this.editingItem();
    const req$ = editing
      ? this.api.updateCatalogItem(editing.id, this.model)
      : this.api.createCatalogItem(this.model);

    req$.subscribe({
      next: () => {
        this.model = { itemType: 'Service', name: '', unit: 'each', unitCost: 0, unitPrice: 0, taxCategory: '' };
        this.submitted.set(false);
        this.touched.set({});
        this.saving.set(false);
        this.closeForm();
        this.load();
      },
      error: (e) => {
        this.error.set(this.message(e));
        this.saving.set(false);
      }
    });
  }

  count(type: string) {
    return this.items().filter((x) => x.itemType === type).length;
  }

  average() {
    return this.items().length ? this.items().reduce((n, x) => n + x.unitPrice, 0) / this.items().length : 0;
  }

  formatTax(val?: string | null): string {
    if (!val || val === '0' || val === 'Non-taxable') return 'Non-taxable';
    if (val === '1' || val === 'TX-TAXABLE') return 'TX-TAXABLE';
    return val;
  }

  private message(e: unknown) {
    return e instanceof HttpErrorResponse ? e.error?.detail || 'Request failed.' : 'Request failed.';
  }
}
