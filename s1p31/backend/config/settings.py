from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROJECT_NAME = "s1p31"
SLUG = "s1p31"
CLIENT_ID = "s1p31"
DOMAIN = "Warehouse fulfilment"
DESCRIPTION = "Daily warehouse operations, service levels and margin"
INPUT_FILE = "s1p31.csv"

RANDOM_STATE = 42
TEST_SIZE = 0.25
CV_FOLDS = 5
LOW_MARGIN_QUANTILE = 0.25      # the weakest quarter of site-days is the group worth acting on and keeps both classes usable
ANOMALY_CONTAMINATION = 0.05    # roughly one site-day in twenty is unusual enough to check by hand
N_SEGMENTS = 3
HORIZON_DAYS = 30               # a month ahead matches the staffing and contract planning cycle
MIN_TRAIN_ROWS = 20
RECOMMENDED_CLASS_ROWS = 100
RECOMMENDED_REG_ROWS = 60
LEAK_AUC = 0.97
LEAK_CORR = 0.95
ROW_CAP = 200

_COLS = [
    ("date", "Date", 1), ("day", "Day_of_Week", 0), ("month", "Month", 0), ("peak", "Peak_Season_Flag", 0),
    ("site", "Warehouse", 1), ("sqft", "Warehouse_Sqft", 0), ("automation", "Automation_Level", 0),
    ("orders_in", "Orders_Received", 1), ("orders_out", "Orders_Shipped", 1), ("backlog", "Backlog_Orders_EOD", 0),
    ("lines", "Order_Lines", 0), ("units", "Units_Shipped", 1), ("labor_hrs", "Direct_Labor_Hours", 1),
    ("temp_hrs", "Temp_Labor_Hours", 0), ("temp_share", "Temp_Labor_Share_pct", 0), ("overtime", "Overtime_Hours", 0),
    ("absent", "Absenteeism_pct", 0), ("uplh", "Units_per_Labor_Hour", 0), ("cycle", "Order_Cycle_Time_Hrs", 0),
    ("dock_stock", "Dock_to_Stock_Hrs", 0), ("ontime", "On_Time_Ship_pct", 0), ("pick_acc", "Pick_Accuracy_pct", 0),
    ("mispicks", "Mispicks", 0), ("damaged", "Damaged_Units", 0), ("returns", "Returns_Processed", 0),
    ("inv_acc", "Inventory_Accuracy_pct", 0), ("storage", "Storage_Utilization_pct", 0),
    ("dock_util", "Dock_Door_Utilization_pct", 0), ("inbound", "Inbound_Pallets", 0), ("outbound", "Outbound_Pallets", 0),
    ("downtime", "Equipment_Downtime_Hrs", 0), ("safety", "Safety_Incidents", 0), ("revenue", "Fulfilment_Revenue", 1),
    ("labor_cost", "Labor_Cost", 0), ("space_cost", "Space_Cost", 0), ("equip_cost", "Equipment_Cost", 0),
    ("pack_cost", "Packaging_Cost", 0), ("error_cost", "Error_Cost", 0), ("overhead_cost", "Overhead_Cost", 0),
    ("total_cost", "Total_Cost", 1), ("profit", "Gross_Profit", 1), ("margin", "Margin_pct", 1),
    ("cost_order", "Cost_per_Order", 0), ("cost_unit", "Cost_per_Unit", 0),
]
COLUMNS = {k: (n, bool(r)) for k, n, r in _COLS}
C = {k: v[0] for k, v in COLUMNS.items()}
TEXT_KEYS = ("date", "day", "month", "site", "automation")
PCT_KEYS = ("temp_share", "absent", "ontime", "pick_acc", "inv_acc", "storage", "dock_util")
CAP_KEYS = ("labor_hrs", "temp_hrs", "overtime", "cycle", "dock_stock", "downtime")

THRESHOLDS = {
    "ontime_min": 95.0,          # typical contract penalty line for on-time shipping
    "pick_acc_min": 99.0,        # below this the cost of re-picks and returns climbs quickly
    "temp_share_max": 20.0,      # past a fifth of hours on agency labor, training load and errors rise
    "overtime_ratio_max": 0.08,  # overtime above 8 percent of paid hours erodes labor margin
    "backlog_ratio_max": 0.05,   # more than 5 percent of the day's orders carried over means the shift under-delivered
    "downtime_max_hrs": 2.0,     # two hours of equipment stoppage removes about a quarter of a shift on a line
    "storage_max": 90.0,         # above 90 percent utilisation pick paths and put-away slow down
    "absent_max": 6.0,           # above 6 percent absence the planned labor plan no longer holds
    "inv_acc_min": 98.5,         # below this, stock-outs and mis-shipments follow
}

TERMINOLOGY = {"revenue": "Fulfilment revenue", "customer": "Client account", "product": "Service", "transaction": "Order"}
BIGQUERY = {"project_id": "", "dataset": "", "table": "feat", "credentials_file": "credentials.json"}
SEGMENT_LABELS = ["Low", "Medium", "High"]
