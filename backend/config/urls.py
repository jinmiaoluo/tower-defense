"""URL configuration for tower-defense-backend project."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/game/", include("game.urls")),
]
