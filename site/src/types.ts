export type Device = {
  id: string;
  split: string;
  sku: string;
  family: string;
  transports: string;
  pact_type: string | number | null;
  pact_code: string | number | null;
  goods_type: string | number | null;
  notes: string;
};

export type Command = {
  id: string;
  split: string;
  families: string;
  transport: "ble" | "ble-notify" | "iot";
  format: string;
  cloud: string;
  name: string;
  op: string;
  payload: string;
  layout: string;
  response: string;
  source: string;
  notes: string;
};

export type Format = {
  id: string;
  split: string;
  format: string;
  role: string;
  command_key: string;
  payload: string;
  source: string;
  notes: string;
};

export type Effect = {
  id: string;
  split: string;
  name: string;
  submode: string;
  payload: string;
  attributes: string;
  source: string;
};

export type Reading = {
  id: string;
  split: string;
  transport: string;
  name: string;
  op: string;
  layout: string;
  source: string;
};

export type StatusProperty = {
  id: string;
  split: string;
  property: string;
  kind: string;
  meaning: string;
  carrier: string;
  source: string;
};

export type SplitMeta = {
  split: string;
  title: string;
  families: string[];
  sku_count: number;
  ble_commands: number;
  ble_notifications: number;
  iot_commands: number;
  dynamic_effects: number;
  other_protocols: Array<{ name: string; details: string; source: string }>;
  notes: string;
};

export type Doc = {
  id: string;
  group: "Guide" | "Split deep dive" | string;
  title: string;
  file: string;
  md: string;
};

export type Meta = {
  generated_from: string;
  split_modules_with_devices: number;
  sku_rows: number;
  ble_command_rows: number;
  ble_notification_rows: number;
  iot_command_rows: number;
  dynamic_effect_rows: number;
  status_property_rows: number;
};

export type SiteData = {
  generatedAt: string;
  meta: Meta;
  transports: Record<string, number>;
  splits: SplitMeta[];
  devices: Device[];
  commands: Command[];
  formats: Format[];
  effects: Effect[];
  readings: Reading[];
  status_properties: StatusProperty[];
  docs: Doc[];
};

export type Detail =
  | { kind: "command"; item: Command }
  | { kind: "device"; item: Device }
  | { kind: "effect"; item: Effect }
  | { kind: "reading"; item: Reading }
  | { kind: "status"; item: StatusProperty };

export type Tab = "overview" | "devices" | "commands" | "effects" | "readings" | "docs" | "status";
