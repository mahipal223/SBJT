export interface ReferenceOption {
  value: string;
  label: string;
  group?: string;
  symbol?: string;
}

export const PAYMENT_METHODS: ReferenceOption[] = [
  { value: 'Card', label: 'Credit / debit card' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Check', label: 'Check' },
  { value: 'BankTransfer', label: 'Bank transfer' }
];

export interface IndustryOption {
  code: string;
  label: string;
  icon: string;
}

export const INDUSTRIES: IndustryOption[] = [
  { code: 'Plumbing', label: 'Plumbing', icon: '🔧' },
  { code: 'Electrical', label: 'Electrical', icon: '⚡' },
  { code: 'HVAC', label: 'HVAC (Heating & Cooling)', icon: '❄️' },
  { code: 'AutoService', label: 'Automotive Service & Repair', icon: '🚗' },
  { code: 'GeneralTrade', label: 'General Trade & Handyman', icon: '🏗️' },
  { code: 'Landscaping', label: 'Landscaping & Grounds Care', icon: '🌿' },
  { code: 'CleaningServices', label: 'Cleaning & Janitorial', icon: '🧹' },
  { code: 'Roofing', label: 'Roofing & Gutters', icon: '🏠' },
  { code: 'ApplianceRepair', label: 'Appliance Repair', icon: '🧺' },
  { code: 'Carpentry', label: 'Carpentry & Woodworking', icon: '🪚' },
  { code: 'Painting', label: 'Painting & Drywall', icon: '🖌️' },
  { code: 'PestControl', label: 'Pest Control', icon: '🐜' },
  { code: 'Other', label: 'Other Service Trade', icon: '🛠️' }
];

export const TIMEZONES: ReferenceOption[] = [
  // North America
  { value: 'America/New_York', label: 'Eastern Time (US & Canada · UTC-5 / UTC-4)', group: 'North America' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada · UTC-6 / UTC-5)', group: 'North America' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada · UTC-7 / UTC-6)', group: 'North America' },
  { value: 'America/Phoenix', label: 'Mountain Standard (Arizona · UTC-7 no DST)', group: 'North America' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada · UTC-8 / UTC-7)', group: 'North America' },
  { value: 'America/Anchorage', label: 'Alaska Time (US · UTC-9 / UTC-8)', group: 'North America' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (US · UTC-10)', group: 'North America' },
  { value: 'America/Toronto', label: 'Toronto / Eastern Canada (UTC-5 / UTC-4)', group: 'North America' },
  { value: 'America/Vancouver', label: 'Vancouver / Pacific Canada (UTC-8 / UTC-7)', group: 'North America' },

  // Europe & UK
  { value: 'Europe/London', label: 'London, Dublin, Lisbon (GMT/BST · UTC+0 / UTC+1)', group: 'Europe' },
  { value: 'Europe/Paris', label: 'Paris, Berlin, Rome, Madrid, Amsterdam (CET · UTC+1 / UTC+2)', group: 'Europe' },
  { value: 'Europe/Athens', label: 'Athens, Bucharest, Helsinki (EET · UTC+2 / UTC+3)', group: 'Europe' },

  // Middle East & Africa
  { value: 'Asia/Dubai', label: 'Dubai, Abu Dhabi, Muscat (GST · UTC+4)', group: 'Middle East & Africa' },
  { value: 'Asia/Riyadh', label: 'Riyadh, Kuwait, Doha (AST · UTC+3)', group: 'Middle East & Africa' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg, Cape Town (SAST · UTC+2)', group: 'Middle East & Africa' },
  { value: 'Africa/Cairo', label: 'Cairo, Alexandria (EET · UTC+2)', group: 'Middle East & Africa' },

  // Asia & Pacific
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST · UTC+5:30)', group: 'Asia & Pacific' },
  { value: 'Asia/Dhaka', label: 'Bangladesh Standard Time (BST · UTC+6)', group: 'Asia & Pacific' },
  { value: 'Asia/Bangkok', label: 'Bangkok, Hanoi, Jakarta (ICT · UTC+7)', group: 'Asia & Pacific' },
  { value: 'Asia/Singapore', label: 'Singapore, Kuala Lumpur (SGT · UTC+8)', group: 'Asia & Pacific' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong, Beijing, Shanghai (HKT · UTC+8)', group: 'Asia & Pacific' },
  { value: 'Asia/Tokyo', label: 'Tokyo, Seoul (JST · UTC+9)', group: 'Asia & Pacific' },

  // Australia & New Zealand
  { value: 'Australia/Sydney', label: 'Sydney, Melbourne, Canberra (AEST · UTC+10 / UTC+11)', group: 'Australia & NZ' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST · UTC+10 no DST)', group: 'Australia & NZ' },
  { value: 'Australia/Adelaide', label: 'Adelaide (ACST · UTC+9:30 / UTC+10:30)', group: 'Australia & NZ' },
  { value: 'Australia/Perth', label: 'Perth (AWST · UTC+8)', group: 'Australia & NZ' },
  { value: 'Pacific/Auckland', label: 'Auckland, Wellington (NZST · UTC+12 / UTC+13)', group: 'Australia & NZ' },

  // Global standard
  { value: 'UTC', label: 'Universal Coordinated Time (UTC)', group: 'Standard' }
];

export const CURRENCIES: ReferenceOption[] = [
  { value: 'USD', label: 'USD — US Dollar ($)', symbol: '$' },
  { value: 'EUR', label: 'EUR — Euro (€)', symbol: '€' },
  { value: 'GBP', label: 'GBP — British Pound (£)', symbol: '£' },
  { value: 'CAD', label: 'CAD — Canadian Dollar ($)', symbol: '$' },
  { value: 'AUD', label: 'AUD — Australian Dollar ($)', symbol: '$' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar ($)', symbol: '$' },
  { value: 'INR', label: 'INR — Indian Rupee (₹)', symbol: '₹' },
  { value: 'JPY', label: 'JPY — Japanese Yen (¥)', symbol: '¥' },
  { value: 'SGD', label: 'SGD — Singapore Dollar ($)', symbol: '$' },
  { value: 'AED', label: 'AED — UAE Dirham (د.إ)', symbol: 'د.إ' },
  { value: 'SAR', label: 'SAR — Saudi Riyal (﷼)', symbol: '﷼' },
  { value: 'CHF', label: 'CHF — Swiss Franc (CHF)', symbol: 'CHF' },
  { value: 'ZAR', label: 'ZAR — South African Rand (R)', symbol: 'R' },
  { value: 'MXN', label: 'MXN — Mexican Peso ($)', symbol: '$' },
  { value: 'BRL', label: 'BRL — Brazilian Real (R$)', symbol: 'R$' },
  { value: 'SEK', label: 'SEK — Swedish Krona (kr)', symbol: 'kr' },
  { value: 'NOK', label: 'NOK — Norwegian Krone (kr)', symbol: 'kr' },
  { value: 'DKK', label: 'DKK — Danish Krone (kr)', symbol: 'kr' }
];

export const ARRIVAL_WINDOWS: string[] = [
  '8:00 AM – 10:00 AM',
  '9:00 AM – 11:00 AM',
  '10:00 AM – 12:00 PM',
  '11:00 AM – 1:00 PM',
  '12:00 PM – 2:00 PM',
  '1:00 PM – 3:00 PM',
  '2:00 PM – 4:00 PM',
  '3:00 PM – 5:00 PM',
  '4:00 PM – 6:00 PM',
  'All Day (Flexible)'
];

export const US_STATES_AND_PROVINCES: { code: string; label: string; name: string }[] = [
  { code: 'AL', label: 'AL — Alabama', name: 'Alabama' },
  { code: 'AK', label: 'AK — Alaska', name: 'Alaska' },
  { code: 'AZ', label: 'AZ — Arizona', name: 'Arizona' },
  { code: 'AR', label: 'AR — Arkansas', name: 'Arkansas' },
  { code: 'CA', label: 'CA — California', name: 'California' },
  { code: 'CO', label: 'CO — Colorado', name: 'Colorado' },
  { code: 'CT', label: 'CT — Connecticut', name: 'Connecticut' },
  { code: 'DE', label: 'DE — Delaware', name: 'Delaware' },
  { code: 'DC', label: 'DC — District of Columbia', name: 'District of Columbia' },
  { code: 'FL', label: 'FL — Florida', name: 'Florida' },
  { code: 'GA', label: 'GA — Georgia', name: 'Georgia' },
  { code: 'HI', label: 'HI — Hawaii', name: 'Hawaii' },
  { code: 'ID', label: 'ID — Idaho', name: 'Idaho' },
  { code: 'IL', label: 'IL — Illinois', name: 'Illinois' },
  { code: 'IN', label: 'IN — Indiana', name: 'Indiana' },
  { code: 'IA', label: 'IA — Iowa', name: 'Iowa' },
  { code: 'KS', label: 'KS — Kansas', name: 'Kansas' },
  { code: 'KY', label: 'KY — Kentucky', name: 'Kentucky' },
  { code: 'LA', label: 'LA — Louisiana', name: 'Louisiana' },
  { code: 'ME', label: 'ME — Maine', name: 'Maine' },
  { code: 'MD', label: 'MD — Maryland', name: 'Maryland' },
  { code: 'MA', label: 'MA — Massachusetts', name: 'Massachusetts' },
  { code: 'MI', label: 'MI — Michigan', name: 'Michigan' },
  { code: 'MN', label: 'MN — Minnesota', name: 'Minnesota' },
  { code: 'MS', label: 'MS — Mississippi', name: 'Mississippi' },
  { code: 'MO', label: 'MO — Missouri', name: 'Missouri' },
  { code: 'MT', label: 'MT — Montana', name: 'Montana' },
  { code: 'NE', label: 'NE — Nebraska', name: 'Nebraska' },
  { code: 'NV', label: 'NV — Nevada', name: 'Nevada' },
  { code: 'NH', label: 'NH — New Hampshire', name: 'New Hampshire' },
  { code: 'NJ', label: 'NJ — New Jersey', name: 'New Jersey' },
  { code: 'NM', label: 'NM — New Mexico', name: 'New Mexico' },
  { code: 'NY', label: 'NY — New York', name: 'New York' },
  { code: 'NC', label: 'NC — North Carolina', name: 'North Carolina' },
  { code: 'ND', label: 'ND — North Dakota', name: 'North Dakota' },
  { code: 'OH', label: 'OH — Ohio', name: 'Ohio' },
  { code: 'OK', label: 'OK — Oklahoma', name: 'Oklahoma' },
  { code: 'OR', label: 'OR — Oregon', name: 'Oregon' },
  { code: 'PA', label: 'PA — Pennsylvania', name: 'Pennsylvania' },
  { code: 'RI', label: 'RI — Rhode Island', name: 'Rhode Island' },
  { code: 'SC', label: 'SC — South Carolina', name: 'South Carolina' },
  { code: 'SD', label: 'SD — South Dakota', name: 'South Dakota' },
  { code: 'TN', label: 'TN — Tennessee', name: 'Tennessee' },
  { code: 'TX', label: 'TX — Texas', name: 'Texas' },
  { code: 'UT', label: 'UT — Utah', name: 'Utah' },
  { code: 'VT', label: 'VT — Vermont', name: 'Vermont' },
  { code: 'VA', label: 'VA — Virginia', name: 'Virginia' },
  { code: 'WA', label: 'WA — Washington', name: 'Washington' },
  { code: 'WV', label: 'WV — West Virginia', name: 'West Virginia' },
  { code: 'WI', label: 'WI — Wisconsin', name: 'Wisconsin' },
  { code: 'WY', label: 'WY — Wyoming', name: 'Wyoming' },
  // Canada
  { code: 'ON', label: 'ON — Ontario (Canada)', name: 'Ontario' },
  { code: 'BC', label: 'BC — British Columbia (Canada)', name: 'British Columbia' },
  { code: 'AB', label: 'AB — Alberta (Canada)', name: 'Alberta' },
  { code: 'QC', label: 'QC — Quebec (Canada)', name: 'Quebec' },
  // International
  { code: 'INTL', label: 'INTL — International / Other', name: 'International' }
];

export const STATE_CITIES: Record<string, string[]> = {
  TX: ['Austin', 'Dallas', 'Houston', 'San Antonio', 'Fort Worth', 'El Paso', 'Arlington', 'Plano', 'Round Rock', 'Corpus Christi'],
  CA: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Fresno', 'Oakland', 'Long Beach', 'Anaheim'],
  FL: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'St. Petersburg', 'Fort Lauderdale', 'Tallahassee', 'Cape Coral'],
  NY: ['New York', 'Buffalo', 'Rochester', 'Syracuse', 'Albany', 'Yonkers', 'White Plains'],
  IL: ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Springfield', 'Peoria'],
  WA: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Everett', 'Kent'],
  CO: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood', 'Boulder'],
  AZ: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Glendale', 'Tempe'],
  GA: ['Atlanta', 'Augusta', 'Columbus', 'Macon', 'Savannah', 'Athens', 'Sandy Springs'],
  NC: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville'],
  PA: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Reading', 'Erie', 'Scranton'],
  OH: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'],
  MI: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor', 'Lansing'],
  VA: ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News', 'Alexandria'],
  TN: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville', 'Murfreesboro'],
  MA: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell', 'Brockton']
};

export const CATALOG_UNITS: (ReferenceOption & { code?: string })[] = [
  { value: 'each', code: 'each', label: 'each (Single item / unit)' },
  { value: 'hour', code: 'hour', label: 'hour (Labor rate / per hour)' },
  { value: 'visit', code: 'visit', label: 'visit (Standard dispatch fee / callout)' },
  { value: 'day', code: 'day', label: 'day (Full day service)' },
  { value: 'flat', code: 'flat', label: 'flat (Fixed project scope)' },
  { value: 'ft', code: 'ft', label: 'ft (Linear feet)' },
  { value: 'm', code: 'm', label: 'm (Linear meters)' },
  { value: 'sq ft', code: 'sq ft', label: 'sq ft (Square feet)' },
  { value: 'sq m', code: 'sq m', label: 'sq m (Square meters)' },
  { value: 'set', code: 'set', label: 'set (Component set)' },
  { value: 'box', code: 'box', label: 'box (Pack / case)' }
];

export const SMTP_PORTS: { value: number; label: string }[] = [
  { value: 587, label: '587 (STARTTLS — Recommended)' },
  { value: 465, label: '465 (SSL / TLS — Direct secure)' },
  { value: 25, label: '25 (Standard unencrypted)' },
  { value: 2525, label: '2525 (Alternative ISP relay)' }
];
