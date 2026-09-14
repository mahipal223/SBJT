# ServiceDesk — UI/UX Design Wireframes & Component Specifications

**Document Version**: 1.0.0  
**Status**: Approved / Baseline  
**Target Screens**: Desktop (1440px / 1920px), Tablet (768px), Mobile (390px)  
**Design Tokens**: SCSS Variables, DM Sans & Manrope Typography  

---

## 1. Design System Tokens & Color Palette

```text
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│     --navy      │ │      --teal     │ │    --surface    │ │      --ink      │
│     #102936     │ │     #087f74     │ │     #ffffff     │ │     #142d3b     │
│  Sidebar & Brand│ │ Primary Accents │ │ Card Background │ │ Body Typography │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   --teal-tint   │ │     --line      │ │      --red      │ │     --amber     │
│     #e4f5f1     │ │     #dce5ea     │ │     #b43b3b     │ │     #ad6500     │
│ Active Capsules │ │ Component Border│ │ Danger & Errors │ │ Warnings & Sent │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 1.1 Typography Hierarchy
- **Brand & Headings (`h1`, `h2`, `h3`, `.brand`)**: `'Manrope', sans-serif`, Weight: 700 / 800, Letter-spacing: `-0.03em`.
- **Body & Controls (`body`, `button`, `input`, `select`)**: `'DM Sans', system-ui, sans-serif`, Weight: 400 / 500 / 600 / 700.
- **Eyebrow Headers (`.eyebrow`)**: 11px, Bold (800), Uppercase, Letter-spacing: `0.11em`, Color: `var(--teal)`.

---

## 2. Responsive Layout Wireframes

### 2.1 Desktop Layout (1440px / 1920px)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [S] ServiceDesk  │ [🔍 Search customers, jobs, invoices... (Cmd+K)]       [🔔] [AJ]    │
├───────────────┬──┴─────────────────────────────────────────────────────────────────────┤
│ OPERATE       │ Accounts Receivable                                                    │
│ ⌂ Overview    │ Invoices & Payments                          [ + Choose completed job ]│
│ ◎ Customers   │                                                                        │
│ ▣ Jobs   [6]  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐ │
│ ◷ Schedule    │ │ Outstanding  │ │   Overdue    │ │     Paid     │ │     Drafts    │ │
│               │ │   $0.00      │ │    $0.00     │ │  $3,560.00   │ │       1       │ │
│ MONEY         │ └──────────────┘ └──────────────┘ └──────────────┘ └─────────────────┘ │
│ ≈ Estimates   │                                                                        │
│ $ Invoices    │ ┌────────────────────────────────────────────────────────────────────┐ │
│ ❖ Catalog     │ │ 5 invoices                 [ Status: All ▾ ]  [ ⟳ Refresh ]        │ │
│ ↗ Reports     │ ├────────────────────────────────────────────────────────────────────┤ │
│               │ │ INVOICE   CUSTOMER               ISSUED       STATUS       TOTAL   │ │
│ MANAGE        │ │ #INV-005  Blue Wave Mechanical   Sep 12, 2026 ● Draft      $3,735  │ │
│ ♟ Team        │ │ #INV-004  Blue Wave Mechanical   Sep 12, 2026 ● Paid       $1,700  │ │
│ ★ Subscription│ │ #INV-003  API Verification Cust  Sep 11, 2026 ● Paid       $1,139  │ │
│ ⚙ Settings    │ └────────────────────────────────────────────────────────────────────┘ │
│               │                                                                        │
│ [Team Plan]   │                                                                        │
│ [Alex Johnson]│                                                                        │
└───────────────┴────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Tablet Layout (768px Portrait)

```text
┌──────────────────────────────────────────────────────────────┐
│ [ ☰ ] [🔍 Search customers, jobs... ]                [ AJ ] │
├──────────────────────────────────────────────────────────────┤
│ Wednesday, September 10                                      │
│ Good morning, Alex                   [ + Customer ]          │
│ Service business overview            [ + Create job ]        │
│                                                              │
│ ┌────────────────────────────┐ ┌───────────────────────────┐ │
│ │ Jobs today                 │ │ Open estimates            │ │
│ │ 6                          │ │ $4,280                    │ │
│ │ 2 completed · 4 remaining  │ │ 3 awaiting approval       │ │
│ └────────────────────────────┘ └───────────────────────────┘ │
│ ┌────────────────────────────┐ ┌───────────────────────────┐ │
│ │ Outstanding invoices       │ │ Revenue this month        │ │
│ │ $7,450                     │ │ $18,940                   │ │
│ └────────────────────────────┘ └───────────────────────────┘ │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Today's schedule                          View calendar  │ │
│ │ 9:00   Water heater inspection            ● In progress  │ │
│ │ 11:30  Kitchen drain repair               ● On the way   │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │  [⌂] Home    [▣] Jobs    [ (＋) New job ]   [◎] Customers│ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

### 2.3 Mobile Layout (390px iPhone Viewport)

```text
┌────────────────────────────────────────┐
│ [ ☰ ] [🔍 Search... ]           [ AJ ] │
├────────────────────────────────────────┤
│ Jobs / New job                         │
│ Create job                             │
│                                        │
│ [ Cancel ]                             │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ Job details                ● Draft │ │
│ │                                    │ │
│ │ Customer *                         │ │
│ │ ┌────────────────────────────────┐ │ │
│ │ │ Blue Wave Mechanical       × ▾ │ │ │
│ │ └────────────────────────────────┘ │ │
│ │                                    │ │
│ │ Job title *                        │ │
│ │ ┌────────────────────────────────┐ │ │
│ │ │ e.g. Water heater inspection   │ │ │
│ │ └────────────────────────────────┘ │ │
│ │                                    │ │
│ │ Priority                           │ │
│ │ ┌────────────────────────────────┐ │ │
│ │ │ Normal                       ▾ │ │ │
│ │ └────────────────────────────────┘ │ │
│ │                                    │ │
│ │ Date                               │ │
│ │ ┌────────────────────────────────┐ │ │
│ │ │ yyyy-mm-dd                  📅 │ │ │
│ │ └────────────────────────────────┘ │ │
│ └────────────────────────────────────┘ │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │  [⌂]      [▣]     (＋)     [◎]   [⋯]│ │
│ │  Home    Jobs   New job  Cust   More │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

---

## 3. UI Component Library Standards

### 3.1 Dropdown Menus (`@ng-select`)
- **Filter Dropdown (`.filter-ng-select`)**:
  - Height: 40px, Border Radius: 9px, Font-weight: 700.
  - Custom chevron arrow icon with `#647985` fill.
  - Dropdown panel box shadow: `0 10px 25px rgba(16, 41, 54, 0.12)`.
  - Item marked background: `var(--teal-tint)` (`#e4f5f1`).
- **Searchable Selects (Caret Guard)**:
  - When an item is selected and not actively filtered, `caret-color: transparent !important` prevents leading cursor artifact (`|Customer`). Normal caret is restored during active typing.

### 3.2 Action Buttons
- **Primary (`.btn.primary`)**: Background: `var(--teal)`, Color: `#ffffff`, Min-height: 42px, Radius: 8px.
- **Secondary (`.btn`)**: Background: `#ffffff`, Border: `1px solid var(--line)`, Color: `var(--ink)`.
- **Danger (`.btn.danger`)**: Background: `#ffffff`, Border: `1px solid var(--red)`, Color: `var(--red)`.

### 3.3 Status Badges
- **Draft**: Grey background (`#edf2f4`), Text: `#5c707d`.
- **Scheduled / In Progress**: Amber background (`#fff3d8`), Text: `#ad6500`.
- **Issued / Active**: Teal background (`#e4f5f1`), Text: `#087f74`.
- **Paid / Completed**: Mint background (`#ccebe5`), Text: `#14323e`.
- **Overdue / Voided**: Red background (`#ffeded`), Text: `#b43b3b`.
