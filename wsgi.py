from app import app
from analytics_integration import install_analytics


install_analytics(app)
application = app
