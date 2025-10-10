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

    # --- expose pp_lang cookie to templates as `lang` ---
    from flask import request, g

    @app.before_request
    def _pp_set_lang():
        lang = request.cookies.get('pp_lang') or 'es'
        if lang not in ('es', 'en'):
            lang = 'es'
        g.lang = lang

    @app.context_processor
    def _pp_inject_lang():
        # available in Jinja: {{ lang }}
        return {'lang': getattr(g, 'lang', 'es')}

    # --- localized date filter without external deps ---
    from datetime import datetime, date

    @app.template_filter('pp_date')
    def pp_date(value, lang='es'):
        """
        Format a date (string/date/datetime) in a friendly long form
        without external libraries.
        ES example: 10 de Octubre, 2025
        EN example: October 10, 2025
        """
        # Parse to datetime
        try:
            if isinstance(value, datetime):
                dt = value
            elif isinstance(value, date):
                dt = datetime(value.year, value.month, value.day)
            elif isinstance(value, str):
                s = value.strip().replace('Z', '').replace('T', ' ')
                try:
                    dt = datetime.fromisoformat(s)
                except Exception:
                    dt = datetime.fromisoformat(s.split(' ')[0])
            else:
                return str(value)
        except Exception:
            return str(value)

        months_es = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ]
        months_en = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]
        m_es = months_es[dt.month - 1]
        m_en = months_en[dt.month - 1]

        if lang == 'en':
            # October 10, 2025
            return f"{m_en} {dt.day}, {dt.year}"
        else:
            # 10 de Octubre, 2025
            return f"{dt.day} de {m_es}, {dt.year}"

    return app