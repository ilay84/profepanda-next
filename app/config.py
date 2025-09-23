import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev")
    DATA_FOLDER = "data"
    AUDIO_WORD_FOLDER = "static/audio/word"
    AUDIO_EXAMPLES_FOLDER = "static/audio/examples"

class DevConfig(Config):
    DEBUG = True

class ProdConfig(Config):
    DEBUG = False