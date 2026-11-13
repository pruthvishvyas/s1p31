import warnings
warnings.filterwarnings("ignore")
from src.utils.paths import ensure_dirs
from src.serving.feed import export_all

if __name__ == "__main__":
    ensure_dirs()
    export_all()
