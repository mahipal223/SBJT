import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({selector:'app-dashboard',imports:[RouterLink],template:`
<main class="page"><header class="page-head"><div><p class="eyebrow">Wednesday, September 10</p><h1>Good morning, Alex</h1><p>Here’s what is happening with your service business today.</p></div><div class="page-actions"><a class="btn" routerLink="/app/customers">＋ Customer</a><a class="btn primary" routerLink="/app/jobs/new">＋ Create job</a></div></header>
<section class="grid cols-4"><article class="card stat"><span class="stat-label">Jobs today</span><strong class="stat-value">6</strong><span class="stat-meta">2 completed · 4 remaining</span></article><article class="card stat"><span class="stat-label">Open estimates</span><strong class="stat-value">$4,280</strong><span class="stat-meta">3 awaiting approval</span></article><article class="card stat"><span class="stat-label">Outstanding invoices</span><strong class="stat-value">$7,450</strong><span class="stat-meta">$1,250 overdue</span></article><article class="card stat"><span class="stat-label">Revenue this month</span><strong class="stat-value">$18,940</strong><span class="stat-meta">↑ 12.4% from August</span></article></section>
<section class="split section-gap"><article class="card"><div class="card-head"><h2>Today’s schedule</h2><a class="link" routerLink="/app/schedule">View calendar</a></div><div class="card-body list">@for(job of jobs;track job.id){<div class="list-row"><div class="person"><span class="avatar">{{job.time}}</span><span class="cell-main"><strong>{{job.title}}</strong><small>{{job.customer}} · {{job.address}}</small></span></div><span class="badge" [class.amber]="job.status==='On the way'" [class.blue]="job.status==='Scheduled'">{{job.status}}</span></div>}</div></article>
<aside class="grid"><article class="card"><div class="card-head"><h2>Quick actions</h2></div><div class="card-body grid cols-2"><a class="btn" routerLink="/app/estimates">New estimate</a><a class="btn" routerLink="/app/invoices">New invoice</a><a class="btn" routerLink="/app/catalog">Add service</a><a class="btn" routerLink="/app/team">Invite staff</a></div></article><article class="card"><div class="card-head"><h2>Needs attention</h2><span class="badge red">3</span></div><div class="card-body list"><div class="list-row"><span class="cell-main"><strong>Invoice #INV-1048</strong><small>Overdue by 8 days</small></span><b class="money">$850</b></div><div class="list-row"><span class="cell-main"><strong>Low plan capacity</strong><small>84 of 100 jobs used</small></span><a class="link" routerLink="/app/subscription">Review</a></div></div></article></aside></section></main>`})
export class DashboardPage{jobs=[{id:1,time:'9:00',title:'Water heater inspection',customer:'Sarah Miller',address:'2401 Lakeview Dr',status:'In progress'},{id:2,time:'11:30',title:'Kitchen drain repair',customer:'Michael Brown',address:'88 Congress Ave',status:'On the way'},{id:3,time:'2:00',title:'Panel safety check',customer:'Olivia Davis',address:'711 West 6th St',status:'Scheduled'}]}

@Component({selector:'app-customers',imports:[RouterLink],template:`
<main class="page"><header class="page-head"><div><p class="eyebrow">Customer relationship management</p><h1>Customers</h1><p>People, properties, job history, and billing details.</p></div><div class="page-actions"><button class="btn">Import CSV</button><a class="btn primary" routerLink="/app/customers/new">＋ New customer</a></div></header><section class="card"><div class="toolbar"><div class="search"><input aria-label="Search customers" placeholder="Search name, phone, email, or address"></div><select class="filter-select" aria-label="Customer status"><option>All customers</option><option>Active</option><option>Inactive</option></select></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Customer</th><th>Contact</th><th>Service address</th><th>Jobs</th><th>Balance</th><th>Status</th></tr></thead><tbody>@for(c of customers;track c.name){<tr><td><a class="person link" routerLink="/app/customers/detail"><span class="avatar">{{c.initials}}</span><span class="cell-main"><strong>{{c.name}}</strong><small>Customer since {{c.since}}</small></span></a></td><td><span class="cell-main"><strong>{{c.phone}}</strong><small>{{c.email}}</small></span></td><td>{{c.address}}</td><td>{{c.jobs}}</td><td class="money">{{c.balance}}</td><td><span class="badge" [class.gray]="c.status==='Inactive'">{{c.status}}</span></td></tr>}</tbody></table></div></section></main>`})
export class CustomersPage{customers=[{initials:'SM',name:'Sarah Miller',since:'2024',phone:'(512) 555-0142',email:'sarah@example.com',address:'2401 Lakeview Dr, Austin',jobs:8,balance:'$0.00',status:'Active'},{initials:'MB',name:'Michael Brown',since:'2025',phone:'(512) 555-0188',email:'michael@example.com',address:'88 Congress Ave, Austin',jobs:3,balance:'$425.00',status:'Active'},{initials:'OD',name:'Olivia Davis',since:'2023',phone:'(737) 555-0106',email:'olivia@example.com',address:'711 West 6th St, Austin',jobs:12,balance:'$850.00',status:'Active'},{initials:'JW',name:'James Wilson',since:'2024',phone:'(512) 555-0199',email:'james@example.com',address:'3902 Duval St, Austin',jobs:2,balance:'$0.00',status:'Inactive'}]}

@Component({selector:'app-customer-detail',imports:[RouterLink],template:`
<main class="page"><header class="page-head"><div class="person"><span class="avatar">SM</span><div><p class="eyebrow">Customer #C-1024</p><h1>Sarah Miller</h1><p>Residential customer · Active since March 2024</p></div></div><div class="page-actions"><a class="btn" routerLink="/app/customers">← Back</a><a class="btn primary" routerLink="/app/jobs/new">＋ Create job</a></div></header><nav class="tabs"><a class="active">Overview</a><a>Jobs (8)</a><a>Estimates (3)</a><a>Invoices (7)</a><a>Activity</a></nav><section class="split"><div class="grid"><article class="card"><div class="card-head"><h2>Contact details</h2><button class="btn small">Edit</button></div><div class="card-body form-grid"><div><small class="muted">PHONE</small><p>(512) 555-0142</p></div><div><small class="muted">EMAIL</small><p>sarah@example.com</p></div><div class="wide"><small class="muted">BILLING ADDRESS</small><p>2401 Lakeview Drive, Austin, TX 78703</p></div></div></article><article class="card"><div class="card-head"><h2>Recent jobs</h2><a class="link" routerLink="/app/jobs">View all</a></div><div class="card-body list"><div class="list-row"><span class="cell-main"><strong>Water heater inspection</strong><small>Sep 10 · Job #J-1084</small></span><span class="badge amber">In progress</span></div><div class="list-row"><span class="cell-main"><strong>Bathroom faucet replacement</strong><small>Jul 22 · Job #J-0991</small></span><span class="badge">Completed</span></div></div></article></div><aside class="grid"><article class="card"><div class="card-head"><h2>Account summary</h2></div><div class="card-body list"><div class="list-row"><span class="muted">Lifetime value</span><b>$4,860</b></div><div class="list-row"><span class="muted">Open balance</span><b>$0.00</b></div><div class="list-row"><span class="muted">Completed jobs</span><b>7</b></div></div></article><article class="card"><div class="card-head"><h2>Service locations</h2></div><div class="card-body"><strong>Home</strong><p class="muted">2401 Lakeview Drive<br>Austin, TX 78703</p><button class="btn small">＋ Add location</button></div></article></aside></section></main>`})
export class CustomerDetailPage{}

@Component({selector:'app-customer-form',imports:[RouterLink],template:`
<main class="page"><header class="page-head"><div><p class="eyebrow">Customers</p><h1>Add customer</h1><p>Create the customer once, then attach locations, jobs, estimates, and invoices.</p></div><a class="btn" routerLink="/app/customers">Cancel</a></header><section class="card"><div class="card-head"><h2>Customer details</h2><span class="muted">Fields marked * are required</span></div><form class="card-body form-grid"><div class="field"><label>First name *</label><input placeholder="Sarah"></div><div class="field"><label>Last name *</label><input placeholder="Miller"></div><div class="field"><label>Phone *</label><input placeholder="(512) 555-0100"></div><div class="field"><label>Email</label><input type="email" placeholder="customer@example.com"></div><div class="field wide"><label>Company name</label><input placeholder="Optional"></div><div class="field wide"><label>Service address *</label><input placeholder="Street address"></div><div class="field"><label>City</label><input value="Austin"></div><div class="field"><label>State / ZIP</label><input value="TX 78701"></div><div class="field wide"><label>Internal notes</label><textarea rows="4" placeholder="Access instructions, preferences, or other notes"></textarea></div><div class="wide page-actions"><a class="btn" routerLink="/app/customers">Cancel</a><a class="btn primary" routerLink="/app/customers/detail">Save customer</a></div></form></section></main>`})
export class CustomerFormPage{}

@Component({selector:'app-jobs',imports:[RouterLink],template:`
<main class="page"><header class="page-head"><div><p class="eyebrow">Work orders</p><h1>Jobs</h1><p>Track every visit from new request through completion.</p></div><a class="btn primary" routerLink="/app/jobs/new">＋ Create job</a></header><section class="grid cols-4"><article class="card stat"><span class="stat-label">Unscheduled</span><strong class="stat-value">4</strong><span class="stat-meta">Needs assignment</span></article><article class="card stat"><span class="stat-label">Today</span><strong class="stat-value">6</strong><span class="stat-meta">2 completed</span></article><article class="card stat"><span class="stat-label">In progress</span><strong class="stat-value">2</strong><span class="stat-meta">Technicians active</span></article><article class="card stat"><span class="stat-label">This period</span><strong class="stat-value">84 / 100</strong><span class="stat-meta">Plan usage</span></article></section><section class="card section-gap"><div class="toolbar"><div class="search"><input placeholder="Search job number, customer, or address"></div><select class="filter-select" aria-label="Job status"><option>Status: All</option><option>Draft</option><option>Scheduled</option><option>In progress</option><option>Completed</option><option>Canceled</option></select><input class="filter-select hide-mobile" type="date" aria-label="Job date"></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Job</th><th>Customer</th><th>Schedule</th><th>Assigned to</th><th>Status</th><th>Total</th></tr></thead><tbody>@for(j of jobs;track j.id){<tr><td><a class="cell-main link" routerLink="/app/jobs/detail"><strong>{{j.id}} · {{j.title}}</strong><small>{{j.type}}</small></a></td><td>{{j.customer}}</td><td><span class="cell-main"><strong>{{j.date}}</strong><small>{{j.time}}</small></span></td><td><span class="person"><span class="avatar">{{j.initials}}</span>{{j.tech}}</span></td><td><span class="badge" [class.amber]="j.status==='In progress'" [class.blue]="j.status==='Scheduled'" [class.gray]="j.status==='Draft'">{{j.status}}</span></td><td class="money">{{j.total}}</td></tr>}</tbody></table></div></section></main>`})
export class JobsPage{jobs=[{id:'#J-1084',title:'Water heater inspection',type:'Residential',customer:'Sarah Miller',date:'Sep 10',time:'9:00–10:30 AM',initials:'AJ',tech:'Alex',status:'In progress',total:'$245'},{id:'#J-1085',title:'Kitchen drain repair',type:'Residential',customer:'Michael Brown',date:'Sep 10',time:'11:30 AM–1:00 PM',initials:'MR',tech:'Mike',status:'Scheduled',total:'$425'},{id:'#J-1086',title:'Electrical panel check',type:'Commercial',customer:'Olivia Davis',date:'Sep 10',time:'2:00–3:30 PM',initials:'JL',tech:'Jamie',status:'Scheduled',total:'$380'},{id:'#J-1087',title:'Brake inspection',type:'Automotive',customer:'James Wilson',date:'Unscheduled',time:'—',initials:'—',tech:'Unassigned',status:'Draft',total:'$0'}]}

@Component({selector:'app-job-form',imports:[RouterLink],template:`
<main class="page"><header class="page-head"><div><p class="eyebrow">New work order</p><h1>Create job</h1><p>Schedule now or save as an unscheduled request.</p></div><a class="btn" routerLink="/app/jobs">Cancel</a></header><section class="split"><article class="card"><div class="card-head"><h2>Job details</h2><span class="badge blue">Draft</span></div><form class="card-body form-grid"><div class="field wide"><label>Customer *</label><select><option>Sarah Miller · 2401 Lakeview Dr</option></select></div><div class="field wide"><label>Job title *</label><input value="Water heater inspection"></div><div class="field"><label>Category</label><select><option>Plumbing</option><option>Electrical</option><option>Automotive</option></select></div><div class="field"><label>Priority</label><select><option>Normal</option><option>Urgent</option></select></div><div class="field"><label>Date</label><input type="date" value="2026-09-10"></div><div class="field"><label>Arrival window</label><input value="9:00 AM – 10:30 AM"></div><div class="field wide"><label>Assigned technician</label><select><option>Alex Johnson (me)</option><option>Mike Rodriguez</option><option>Unassigned</option></select></div><div class="field wide"><label>Customer request / internal instructions</label><textarea rows="4">Inspect the 50-gallon water heater and provide replacement options if needed.</textarea></div></form></article><aside class="grid"><article class="card"><div class="card-head"><h2>Services & parts</h2></div><div class="card-body list"><div class="list-row"><span class="cell-main"><strong>Diagnostic visit</strong><small>1 × $125.00</small></span><b>$125.00</b></div><button class="btn">＋ Add line item</button></div></article><article class="card"><div class="card-body list"><div class="list-row"><span>Subtotal</span><b>$125.00</b></div><div class="list-row"><span>Tax</span><b>$0.00</b></div><div class="list-row"><strong>Job total</strong><strong>$125.00</strong></div><a class="btn primary" routerLink="/app/jobs/detail">Create & schedule job</a><button class="btn">Save unscheduled</button></div></article></aside></section></main>`})
export class JobFormPage{}

@Component({
  selector: 'app-job-detail',
  imports: [RouterLink],
  template: `
<main class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Job #J-1084 · In progress</p>
      <h1>Water heater inspection</h1>
      <p>Sarah Miller · 2401 Lakeview Drive, Austin</p>
    </div>
    <div class="page-actions">
      <a class="btn" routerLink="/app/jobs">← Jobs</a>
      <button class="btn primary">Mark complete</button>
    </div>
  </header>

  <nav class="tabs">
    <a [class.active]="activeTab() === 'details'" (click)="activeTab.set('details')">Job details</a>
    <a [class.active]="activeTab() === 'items'" (click)="activeTab.set('items')">Line items</a>
    <a [class.active]="activeTab() === 'photos'" (click)="activeTab.set('photos')">Photos & Files ({{ photos().length }})</a>
    <a [class.active]="activeTab() === 'notes'" (click)="activeTab.set('notes')">Notes</a>
  </nav>

  @if (activeTab() === 'details') {
    <section class="split">
      <div class="grid">
        <article class="card">
          <div class="card-head"><h2>Work summary</h2><span class="badge amber">In progress</span></div>
          <div class="card-body">
            <p>Inspect the existing 50-gallon water heater, test pressure and temperature controls, and provide replacement options if needed.</p>
            <div class="callout"><strong>Customer note:</strong> Gate code 2468. Please call when arriving.</div>
          </div>
        </article>
        <article class="card">
          <div class="card-head"><h2>Services & materials</h2><button class="btn small" (click)="activeTab.set('items')">Manage items</button></div>
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
              <tbody>
                <tr><td>Diagnostic visit</td><td>1</td><td>$125.00</td><td class="money">$125.00</td></tr>
                <tr><td>Temperature relief valve</td><td>1</td><td>$68.00</td><td class="money">$68.00</td></tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
      <aside class="grid">
        <article class="card">
          <div class="card-head"><h2>Schedule</h2><button class="btn small">Edit</button></div>
          <div class="card-body list">
            <div><small class="muted">DATE & TIME</small><p><strong>Sep 10, 2026</strong><br>9:00–10:30 AM</p></div>
            <div><small class="muted">ASSIGNED TO</small><p class="person"><span class="avatar">AJ</span><strong>Alex Johnson</strong></p></div>
          </div>
        </article>
        <article class="card">
          <div class="card-head"><h2>Next step</h2></div>
          <div class="card-body grid">
            <button class="btn primary">Complete job</button>
            <a class="btn" routerLink="/app/invoices">Create invoice</a>
            <a class="btn" routerLink="/app/technician">Open technician view</a>
          </div>
        </article>
      </aside>
    </section>
  }

  @if (activeTab() === 'items') {
    <section class="card section-gap">
      <div class="card-head"><h2>Line items & costs</h2><button class="btn primary small">＋ Add item</button></div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Item / Description</th><th>Type</th><th>Qty</th><th>Rate</th><th>Tax</th><th>Total</th></tr></thead>
          <tbody>
            <tr><td class="cell-main"><strong>Diagnostic visit</strong><small>Standard on-site inspection</small></td><td>Service</td><td>1</td><td>$125.00</td><td>$0.00</td><td class="money">$125.00</td></tr>
            <tr><td class="cell-main"><strong>Temperature relief valve</strong><small>3/4 in brass valve</small></td><td>Part</td><td>1</td><td>$68.00</td><td>$5.61</td><td class="money">$73.61</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  }

  @if (activeTab() === 'photos') {
    <section class="card section-gap">
      <div class="card-head">
        <div>
          <h2>Job attachments & photos</h2>
          <p style="margin:4px 0 0;font-size:12px;color:var(--muted)">Attach before/after photos, equipment tags, and inspection documents.</p>
        </div>
        <label class="btn primary small" style="cursor:pointer">
          ＋ Upload file
          <input type="file" (change)="onFileSelected($event)" multiple accept="image/*,.pdf" style="display:none">
        </label>
      </div>

      <div class="upload-dropzone" (dragover)="$event.preventDefault()" (drop)="onFileDrop($event)">
        <span style="font-size:28px">📷</span>
        <strong>Drag and drop job photos here, or click upload</strong>
        <small style="color:var(--muted)">PNG, JPG, HEIC, PDF up to 15 MB each</small>
      </div>

      <div class="photo-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-top:20px">
        @for (file of photos(); track file.id) {
          <article class="photo-card" style="border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff">
            <div style="height:140px;background:#f0f4f6;display:grid;place-items:center;overflow:hidden">
              @if (file.url) {
                <img [src]="file.url" [alt]="file.name" style="width:100%;height:100%;object-fit:cover">
              } @else {
                <span style="font-size:32px">{{ file.type === 'pdf' ? '📄' : '🖼' }}</span>
              }
            </div>
            <div style="padding:10px">
              <strong style="display:block;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ file.name }}</strong>
              <small style="color:var(--muted);font-size:10px">{{ file.size }} · {{ file.date }}</small>
              <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
                <span class="badge" [class.blue]="file.category==='Before'" [class.amber]="file.category==='After'">{{ file.category }}</span>
                <button class="btn small" style="padding:2px 8px;font-size:10px;color:#c23" (click)="removePhoto(file.id)">Delete</button>
              </div>
            </div>
          </article>
        }
      </div>
    </section>
  }

  @if (activeTab() === 'notes') {
    <section class="card section-gap">
      <div class="card-head"><h2>Internal job notes</h2><button class="btn primary small">＋ Add note</button></div>
      <div class="card-body list">
        <div class="list-row"><span class="cell-main"><strong>Customer requested afternoon reminder</strong><small>Alex Johnson · Sep 9, 2026, 4:15 PM</small></span></div>
        <div class="list-row"><span class="cell-main"><strong>Safety valve leak noticed during initial assessment</strong><small>Mike Rodriguez · Sep 10, 2026, 9:22 AM</small></span></div>
      </div>
    </section>
  }
</main>`,
  styles: `
.upload-dropzone { border: 2px dashed #9bc5cf; border-radius: 10px; padding: 28px; text-align: center; display: grid; place-items: center; gap: 6px; background: #f8fafb; margin-top: 14px; cursor: pointer; transition: border-color .15s; }
.upload-dropzone:hover { border-color: var(--teal); background: #f0f8f8; }
.tabs a { cursor: pointer; }
`
})
export class JobDetailPage {
  readonly activeTab = signal<'details' | 'items' | 'photos' | 'notes'>('details');

  readonly photos = signal([
    { id: '1', name: 'water-heater-nameplate.jpg', size: '1.4 MB', date: 'Sep 10, 9:05 AM', type: 'image', category: 'Before', url: '' },
    { id: '2', name: 'pressure-valve-corrosion.jpg', size: '2.1 MB', date: 'Sep 10, 9:12 AM', type: 'image', category: 'Before', url: '' },
    { id: '3', name: 'gas-shutoff-valve.jpg', size: '1.8 MB', date: 'Sep 10, 9:18 AM', type: 'image', category: 'Before', url: '' },
    { id: '4', name: 'inspection-checklist.pdf', size: '340 KB', date: 'Sep 10, 9:30 AM', type: 'pdf', category: 'Doc', url: '' }
  ]);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(input.files);
    }
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files) {
      this.handleFiles(event.dataTransfer.files);
    }
  }

  private handleFiles(files: FileList): void {
    const newItems = Array.from(files).map((file, idx) => ({
      id: Date.now().toString() + idx,
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      date: 'Just now',
      type: file.type.includes('pdf') ? 'pdf' : 'image',
      category: 'Attachment',
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    }));

    this.photos.update(list => [...newItems, ...list]);
  }

  removePhoto(id: string): void {
    this.photos.update(list => list.filter(p => p.id !== id));
  }
}

