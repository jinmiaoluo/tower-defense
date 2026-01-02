"""Game API URL configuration."""

from django.urls import path

from . import views

urlpatterns = [
    path("sessions", views.CreateSessionView.as_view(), name="create_session"),
    path("sessions/wave", views.SubmitWaveView.as_view(), name="submit_wave"),
    path("sessions/end", views.EndSessionView.as_view(), name="end_session"),
    path("leaderboard", views.LeaderboardView.as_view(), name="leaderboard"),
]
