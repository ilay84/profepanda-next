import os
from flask import Flask

def create_app(config_class="app.config.DevConfig"):
    app = Flask(
        __name__,
        template_folder=os.path.join(os.path.dirname(__file__), '..', 'templates'),
        static_folder=os.path.join(os.path.dirname(__file__), '..', 'static')
    )
    app.config.from_object(config_class)

    # Import blueprints
    from . import routes_public
    app.register_blueprint(routes_public.bp)

    from . import routes_admin
    app.register_blueprint(routes_admin.bp)

    # ✅ Global aliases for all glossaries in country_map
    from .routes_public import country_map  # Import your country mapping

    for code, filename in country_map.items():
        endpoint_name = f"public.glosario_{code}"
        if endpoint_name in routes_public.bp.view_functions:
            app.add_url_rule(
                f"/{code}/glosario",
                endpoint=f"glosario_{code}",
                view_func=routes_public.bp.view_functions[endpoint_name]
            )

    return app  # <-- add this