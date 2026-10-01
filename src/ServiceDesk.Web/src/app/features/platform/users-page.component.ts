import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PlatformAdminApiService,
  PlatformUserDetailResponse,
  CreatePlatformUserRequest,
  UpdatePlatformUserRequest
} from '../../core/platform-admin-api.service';
import { PlatformContextService } from '../../core/platform-context.service';

interface PageAccessOption {
  key: string;
  label: string;
  description: string;
}

@Component({
  selector: 'app-platform-users-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="page-container">
  <!-- Header -->
  <div class="header-card">
    <div class="header-info">
      <h1>Platform Users</h1>
      <p>Manage platform administrative users and customize granular page access.</p>
    </div>
    <div class="header-actions">
      <button type="button" class="btn btn-secondary" (click)="loadUsers()" [disabled]="isLoading()">
        Refresh
      </button>
      <button type="button" class="btn btn-primary" (click)="openCreateModal()">
        + Add Platform User
      </button>
    </div>
  </div>

  <!-- Messages -->
  @if (successMessage()) {
    <div class="alert alert-success">{{ successMessage() }}</div>
  }
  @if (errorMessage()) {
    <div class="alert alert-danger">{{ errorMessage() }}</div>
  }

  <!-- Stats Grid -->
  <div class="stats-grid">
    <div class="stat-card">
      <span class="stat-label">Total Platform Users</span>
      <strong class="stat-value">{{ users().length }}</strong>
    </div>
    <div class="stat-card">
      <span class="stat-label">Active Users</span>
      <strong class="stat-value text-teal">{{ activeUserCount() }}</strong>
    </div>
    <div class="stat-card">
      <span class="stat-label">Custom Access Configured</span>
      <strong class="stat-value text-blue">{{ customAccessCount() }}</strong>
    </div>
    <div class="stat-card">
      <span class="stat-label">Your Account</span>
      <strong class="stat-value current-user">{{ platformContext.fullName() || 'You' }}</strong>
    </div>
  </div>

  <!-- Users Table Card -->
  <div class="card">
    <div class="card-header">
      <div class="card-title-group">
        <h2>Registered Platform Users</h2>
        <span class="badge">{{ users().length }} total</span>
      </div>
    </div>

    @if (isLoading()) {
      <div class="empty-state">
        <div class="spinner"></div>
        <p>Loading platform users...</p>
      </div>
    } @else if (users().length === 0) {
      <div class="empty-state">
        <p>No platform users registered yet.</p>
      </div>
    } @else {
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Platform User</th>
              <th>Status</th>
              <th>Custom Page Access</th>
              <th>Created</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (user of users(); track user.id) {
              <tr>
                <td>
                  <div class="user-cell">
                    <span class="user-avatar">{{ getInitials(user.fullName) }}</span>
                    <div>
                      <strong>{{ user.fullName }}</strong>
                      <span class="user-email">{{ user.email }}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="status-pill" [class.active]="user.isActive" [class.inactive]="!user.isActive">
                    {{ user.isActive ? 'Active' : 'Deactivated' }}
                  </span>
                </td>
                <td>
                  <div class="badge-list">
                    @for (page of user.pageAccess; track page) {
                      <span class="page-badge" [class.key-users]="page === 'users'">{{ getPageLabel(page) }}</span>
                    }
                  </div>
                </td>
                <td class="date-cell">
                  {{ user.createdAt ? (user.createdAt | date:'mediumDate') : '—' }}
                </td>
                <td class="text-right">
                  <div class="action-buttons">
                    <button type="button" class="btn-action edit" (click)="openEditModal(user)">
                      Edit Access
                    </button>
                    @if (user.id !== currentUserId()) {
                      <button type="button" class="btn-action delete" (click)="confirmDelete(user)">
                        Delete
                      </button>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  </div>

  <!-- Create Modal -->
  @if (isCreateModalOpen()) {
    <div class="modal-backdrop" (click)="closeCreateModal()">
      <div class="modal-panel" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Add New Platform User</h3>
          <button type="button" class="btn-close" (click)="closeCreateModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group" [class.has-error]="formErrors().fullName">
            <label for="createFullName">Full Name *</label>
            <input
              id="createFullName"
              type="text"
              class="form-control"
              [(ngModel)]="createForm.fullName"
              placeholder="e.g. Mahipal Sharma" />
            @if (formErrors().fullName) {
              <span class="field-error">{{ formErrors().fullName }}</span>
            }
          </div>

          <div class="form-group" [class.has-error]="formErrors().email">
            <label for="createEmail">Email Address *</label>
            <input
              id="createEmail"
              type="email"
              class="form-control"
              [(ngModel)]="createForm.email"
              placeholder="e.g. user@servicedesk.local" />
            @if (formErrors().email) {
              <span class="field-error">{{ formErrors().email }}</span>
            }
          </div>

          <div class="form-group">
            <label for="createPassword">Initial Password (Optional)</label>
            <input
              id="createPassword"
              type="password"
              class="form-control"
              [(ngModel)]="createForm.initialPassword"
              placeholder="Leave blank to generate secure initial secret" />
            <small class="field-hint">If left empty, a secure password will be auto-generated.</small>
          </div>

          <div class="form-group">
            <div class="access-header-row">
              <label>Custom Page Access *</label>
              <div class="access-shortcuts">
                <button type="button" class="btn-link" (click)="selectAllPages(createForm)">Select All</button>
                <span>|</span>
                <button type="button" class="btn-link" (click)="clearAllPages(createForm)">Clear</button>
              </div>
            </div>
            <div class="page-checkboxes">
              @for (option of availablePages; track option.key) {
                <label class="checkbox-card" [class.selected]="hasPage(createForm.pageAccess, option.key)">
                  <input
                    type="checkbox"
                    [checked]="hasPage(createForm.pageAccess, option.key)"
                    (change)="togglePage(createForm.pageAccess, option.key)" />
                  <div class="checkbox-text">
                    <strong>{{ option.label }}</strong>
                    <small>{{ option.description }}</small>
                  </div>
                </label>
              }
            </div>
            @if (formErrors().pageAccess) {
              <span class="field-error">{{ formErrors().pageAccess }}</span>
            }
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="closeCreateModal()" [disabled]="isSubmitting()">
            Cancel
          </button>
          <button type="button" class="btn btn-primary" (click)="submitCreate()" [disabled]="isSubmitting()">
            {{ isSubmitting() ? 'Creating...' : 'Create Platform User' }}
          </button>
        </div>
      </div>
    </div>
  }

  <!-- Edit Modal -->
  @if (isEditModalOpen() && selectedUser()) {
    <div class="modal-backdrop" (click)="closeEditModal()">
      <div class="modal-panel" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Edit Platform User Access</h3>
          <button type="button" class="btn-close" (click)="closeEditModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="user-summary-bar">
            <strong>{{ selectedUser()?.email }}</strong>
            <span class="role-pill">{{ selectedUser()?.role }}</span>
          </div>

          <div class="form-group" [class.has-error]="formErrors().fullName">
            <label for="editFullName">Full Name *</label>
            <input
              id="editFullName"
              type="text"
              class="form-control"
              [(ngModel)]="editForm.fullName" />
            @if (formErrors().fullName) {
              <span class="field-error">{{ formErrors().fullName }}</span>
            }
          </div>

          <div class="form-group">
            <label class="toggle-row">
              <input type="checkbox" [(ngModel)]="editForm.isActive" />
              <span>Active Account</span>
            </label>
            <small class="field-hint">Inactive users cannot log into the platform console.</small>
          </div>

          <div class="form-group">
            <div class="access-header-row">
              <label>Custom Page Access *</label>
              <div class="access-shortcuts">
                <button type="button" class="btn-link" (click)="selectAllPages(editForm)">Select All</button>
                <span>|</span>
                <button type="button" class="btn-link" (click)="clearAllPages(editForm)">Clear</button>
              </div>
            </div>
            <div class="page-checkboxes">
              @for (option of availablePages; track option.key) {
                <label class="checkbox-card" [class.selected]="hasPage(editForm.pageAccess, option.key)">
                  <input
                    type="checkbox"
                    [checked]="hasPage(editForm.pageAccess, option.key)"
                    (change)="togglePage(editForm.pageAccess, option.key)" />
                  <div class="checkbox-text">
                    <strong>{{ option.label }}</strong>
                    <small>{{ option.description }}</small>
                  </div>
                </label>
              }
            </div>
            @if (formErrors().pageAccess) {
              <span class="field-error">{{ formErrors().pageAccess }}</span>
            }
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="closeEditModal()" [disabled]="isSubmitting()">
            Cancel
          </button>
          <button type="button" class="btn btn-primary" (click)="submitEdit()" [disabled]="isSubmitting()">
            {{ isSubmitting() ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>
  }
</div>
  `,
  styles: `
:host { display: block; }
.page-container { display: flex; flex-direction: column; gap: 20px; }
.header-card { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; background: #fff; border: 1px solid var(--line); border-radius: 5px; }
.header-info h1 { margin: 0 0 4px; font-size: 20px; font-weight: 800; color: var(--navy); font-family: 'Manrope', sans-serif; }
.header-info p { margin: 0; font-size: 13px; color: var(--ink-light); }
.header-actions { display: flex; gap: 10px; }
.btn { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 16px; border-radius: 5px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: 1px solid transparent; }
.btn-primary { background: var(--teal); color: #fff; border-color: var(--teal-dark); }
.btn-primary:hover:not(:disabled) { background: var(--teal-dark); }
.btn-secondary { background: #fff; color: var(--navy); border-color: var(--line); }
.btn-secondary:hover:not(:disabled) { background: #f5f8fa; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
.stat-card { background: #fff; border: 1px solid var(--line); border-radius: 5px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.stat-label { font-size: 11px; font-weight: 700; color: var(--ink-light); text-transform: uppercase; letter-spacing: .05em; }
.stat-value { font-size: 20px; font-weight: 800; color: var(--navy); font-family: 'Manrope', sans-serif; }
.stat-value.text-teal { color: var(--teal-dark); }
.stat-value.text-blue { color: #1e6080; }
.stat-value.current-user { font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card { background: #fff; border: 1px solid var(--line); border-radius: 5px; overflow: hidden; }
.card-header { padding: 14px 18px; border-bottom: 1px solid var(--line); background: #fafbfc; }
.card-title-group { display: flex; align-items: center; gap: 10px; }
.card-title-group h2 { margin: 0; font-size: 14px; font-weight: 700; color: var(--navy); }
.badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 5px; background: #eef2f5; color: var(--navy); }
.table-container { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
th, td { padding: 11px 14px; border-bottom: 1px solid var(--line); }
th { background: #f8fafb; font-weight: 700; color: var(--ink-light); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
td { color: var(--ink); vertical-align: middle; }
tr:last-child td { border-bottom: 0; }
.user-cell { display: flex; align-items: center; gap: 10px; }
.user-avatar { width: 32px; height: 32px; border-radius: 5px; background: var(--teal-tint); color: var(--teal-dark); border: 1px solid #b7e8de; font-size: 11px; font-weight: 800; display: grid; place-items: center; flex-shrink: 0; }
.user-cell strong { display: block; color: var(--navy); font-size: 13px; }
.user-email { display: block; font-size: 11px; color: var(--ink-light); }
.status-pill { display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 5px; }
.status-pill.active { background: #e6f7f2; color: #0a735e; border: 1px solid #a9e4d5; }
.status-pill.inactive { background: #fde8e8; color: #9b1c1c; border: 1px solid #f8b4b4; }
.badge-list { display: flex; flex-wrap: wrap; gap: 4px; }
.page-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 5px; background: #f0f4f7; color: #2d5568; border: 1px solid #d5e1e8; }
.page-badge.key-users { background: #eaf1fb; color: #1c4b82; border-color: #bad3f3; }
.date-cell { font-size: 12px; color: var(--ink-light); }
.text-right { text-align: right; }
.action-buttons { display: inline-flex; gap: 6px; }
.btn-action { height: 28px; padding: 0 10px; border-radius: 5px; font-size: 11px; font-weight: 600; cursor: pointer; border: 1px solid var(--line); background: #fff; color: var(--navy); }
.btn-action.edit:hover { background: #f0f6fa; border-color: #8cb5c2; }
.btn-action.delete { color: var(--red); border-color: #ffd0d0; }
.btn-action.delete:hover { background: var(--red-bg); border-color: var(--red); }
.empty-state { padding: 48px; text-align: center; color: var(--ink-light); }
.spinner { width: 26px; height: 26px; border: 3px solid var(--line); border-top-color: var(--teal); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 10px; }
@keyframes spin { to { transform: rotate(360deg); } }
.alert { padding: 12px 16px; border-radius: 5px; font-size: 13px; font-weight: 600; }
.alert-success { background: #e6f7f2; color: #0a735e; border: 1px solid #a9e4d5; }
.alert-danger { background: #fde8e8; color: #9b1c1c; border: 1px solid #f8b4b4; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(10,28,36,.55); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; }
.modal-panel { background: #fff; width: 100%; max-width: 520px; max-height: 90vh; border-radius: 5px; box-shadow: 0 12px 36px rgba(0,0,0,.22); display: flex; flex-direction: column; overflow: hidden; }
.modal-header, .modal-footer { padding: 14px 18px; border-bottom: 1px solid var(--line); background: #fafbfc; display: flex; align-items: center; justify-content: space-between; }
.modal-footer { border-bottom: 0; border-top: 1px solid var(--line); justify-content: flex-end; gap: 10px; }
.modal-header h3 { margin: 0; font-size: 15px; font-weight: 800; color: var(--navy); font-family: 'Manrope', sans-serif; }
.btn-close { background: transparent; border: 0; font-size: 22px; color: var(--ink-light); cursor: pointer; }
.modal-body { padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group label { font-size: 12px; font-weight: 700; color: var(--navy); }
.form-control { height: 36px; padding: 0 10px; border: 1px solid var(--line); border-radius: 5px; font-size: 13px; color: var(--ink); outline: none; box-sizing: border-box; }
.form-control:focus { border-color: var(--teal); }
.form-group.has-error .form-control { border-color: var(--red); box-shadow: 0 0 0 1px var(--red); }
.field-error { font-size: 11px; font-weight: 600; color: var(--red); }
.field-hint { font-size: 11px; color: var(--ink-light); }
.access-header-row { display: flex; align-items: center; justify-content: space-between; }
.access-shortcuts { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ink-light); }
.btn-link { background: transparent; border: 0; padding: 0; color: var(--teal-dark); font-weight: 700; cursor: pointer; text-decoration: underline; font-size: 11px; }
.page-checkboxes { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 2px; }
.checkbox-card { display: flex; align-items: flex-start; gap: 8px; padding: 7px 9px; border-radius: 5px; border: 1px solid var(--line); background: #fff; cursor: pointer; }
.checkbox-card.selected { border-color: var(--teal); background: #f0faf8; }
.checkbox-text { display: flex; flex-direction: column; gap: 1px; }
.checkbox-text strong { font-size: 12px; color: var(--navy); }
.checkbox-text small { font-size: 10px; color: var(--ink-light); line-height: 1.2; }
.toggle-row { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--navy); cursor: pointer; }
.user-summary-bar { padding: 8px 12px; background: #f5f8fa; border: 1px solid var(--line); border-radius: 5px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
.role-pill { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 5px; background: var(--teal-tint); color: var(--teal-dark); }
@media (max-width: 600px) {
  .page-checkboxes { grid-template-columns: 1fr; }
  .header-card { flex-direction: column; align-items: flex-start; gap: 12px; }
}
  `
})
export class PlatformUsersPageComponent implements OnInit {
  private readonly api = inject(PlatformAdminApiService);
  readonly platformContext = inject(PlatformContextService);

  readonly users = signal<PlatformUserDetailResponse[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Modals
  readonly isCreateModalOpen = signal<boolean>(false);
  readonly isEditModalOpen = signal<boolean>(false);
  readonly selectedUser = signal<PlatformUserDetailResponse | null>(null);

  // Form errors
  readonly formErrors = signal<{ fullName?: string; email?: string; pageAccess?: string }>({});

  // Available custom page access definitions
  readonly availablePages: PageAccessOption[] = [
    { key: 'overview', label: 'Overview & Telemetry', description: 'Metrics, tenant activity & health' },
    { key: 'workspaces', label: 'Tenant Workspaces', description: 'Search, review & manage businesses' },
    { key: 'plans', label: 'Plans & Entitlements', description: 'Plan configurations & tier quotas' },
    { key: 'users', label: 'Platform Users', description: 'Manage administrators & page permissions' },
    { key: 'backups', label: 'Backups & DR', description: 'Inspect backups & run restore jobs' },
    { key: 'audit', label: 'Platform Audit Log', description: 'Append-only audit trail entries' },
    { key: 'smtp', label: 'Platform SMTP', description: 'Configure relay server settings' },
    { key: 'security', label: 'Security & Policy', description: 'Password complexity & lockout rules' }
  ];

  readonly createForm = {
    fullName: '',
    email: '',
    initialPassword: '',
    pageAccess: ['overview', 'workspaces']
  };

  readonly editForm = {
    fullName: '',
    isActive: true,
    pageAccess: [] as string[]
  };

  readonly currentUserId = computed(() => this.platformContext.operator()?.id ?? '');
  readonly activeUserCount = computed(() => this.users().filter(u => u.isActive).length);
  readonly customAccessCount = computed(() => this.users().filter(u => u.pageAccess.length > 0).length);

  ngOnInit(): void {
    void this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      this.api.getPlatformUsers().subscribe({
        next: (res) => {
          this.users.set(res);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.errorMessage.set(err?.error?.detail || err?.message || 'Failed to load platform users.');
        }
      });
    } catch {
      this.isLoading.set(false);
      this.errorMessage.set('Unexpected error loading platform users.');
    }
  }

  getInitials(fullName: string): string {
    if (!fullName) return 'PU';
    const parts = fullName.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : fullName.substring(0, 2).toUpperCase();
  }

  getPageLabel(key: string): string {
    const found = this.availablePages.find(p => p.key === key.toLowerCase());
    return found ? found.label : key;
  }

  hasPage(accessList: string[], key: string): boolean {
    return accessList.includes(key);
  }

  togglePage(accessList: string[], key: string): void {
    const idx = accessList.indexOf(key);
    if (idx >= 0) {
      accessList.splice(idx, 1);
    } else {
      accessList.push(key);
    }
  }

  selectAllPages(target: { pageAccess: string[] }): void {
    target.pageAccess.length = 0;
    target.pageAccess.push(...this.availablePages.map(p => p.key));
  }

  clearAllPages(target: { pageAccess: string[] }): void {
    target.pageAccess.length = 0;
  }

  openCreateModal(): void {
    this.formErrors.set({});
    this.createForm.fullName = '';
    this.createForm.email = '';
    this.createForm.initialPassword = '';
    this.createForm.pageAccess = ['overview', 'workspaces'];
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  openEditModal(user: PlatformUserDetailResponse): void {
    this.formErrors.set({});
    this.selectedUser.set(user);
    this.editForm.fullName = user.fullName;
    this.editForm.isActive = user.isActive;
    this.editForm.pageAccess = [...user.pageAccess];
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    this.isEditModalOpen.set(false);
    this.selectedUser.set(null);
  }

  private validateCreateForm(): boolean {
    const errors: { fullName?: string; email?: string; pageAccess?: string } = {};
    if (!this.createForm.fullName || !this.createForm.fullName.trim()) {
      errors.fullName = 'Full name is required.';
    }
    if (!this.createForm.email || !this.createForm.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.createForm.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (!this.createForm.pageAccess || this.createForm.pageAccess.length === 0) {
      errors.pageAccess = 'At least one page permission must be selected.';
    }

    this.formErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  private validateEditForm(): boolean {
    const errors: { fullName?: string; pageAccess?: string } = {};
    if (!this.editForm.fullName || !this.editForm.fullName.trim()) {
      errors.fullName = 'Full name is required.';
    }
    if (!this.editForm.pageAccess || this.editForm.pageAccess.length === 0) {
      errors.pageAccess = 'At least one page permission must be selected.';
    }

    this.formErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  submitCreate(): void {
    if (!this.validateCreateForm()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const req: CreatePlatformUserRequest = {
      fullName: this.createForm.fullName.trim(),
      email: this.createForm.email.trim(),
      initialPassword: this.createForm.initialPassword.trim() || undefined,
      pageAccess: this.createForm.pageAccess
    };

    this.api.createPlatformUser(req).subscribe({
      next: (created) => {
        this.isSubmitting.set(false);
        this.isCreateModalOpen.set(false);
        this.successMessage.set(`Platform user "${created.fullName}" created successfully.`);
        void this.loadUsers();
        setTimeout(() => this.successMessage.set(null), 4000);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.detail || err?.message || 'Failed to create platform user.');
      }
    });
  }

  submitEdit(): void {
    const user = this.selectedUser();
    if (!user) return;
    if (!this.validateEditForm()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const req: UpdatePlatformUserRequest = {
      fullName: this.editForm.fullName.trim(),
      isActive: this.editForm.isActive,
      pageAccess: this.editForm.pageAccess
    };

    this.api.updatePlatformUser(user.id, req).subscribe({
      next: (updated) => {
        this.isSubmitting.set(false);
        this.isEditModalOpen.set(false);
        this.successMessage.set(`Platform user "${updated.fullName}" updated successfully.`);
        void this.loadUsers();
        setTimeout(() => this.successMessage.set(null), 4000);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.detail || err?.message || 'Failed to update platform user.');
      }
    });
  }

  confirmDelete(user: PlatformUserDetailResponse): void {
    if (!confirm(`Are you sure you want to delete platform user "${user.fullName}" (${user.email})?`)) {
      return;
    }

    this.errorMessage.set(null);
    this.api.deletePlatformUser(user.id).subscribe({
      next: () => {
        this.successMessage.set(`Platform user "${user.fullName}" removed.`);
        void this.loadUsers();
        setTimeout(() => this.successMessage.set(null), 4000);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || err?.message || 'Failed to delete platform user.');
      }
    });
  }
}
