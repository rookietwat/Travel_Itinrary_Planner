import sys
from pathlib import Path
from datetime import date, timedelta
import json
import urllib.parse
import streamlit as st

# Ensure backend modules can be imported
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.schemas import TripPreferences, Activity
from app.planner import plan_offline
from app.ai import ItineraryGenerator
from app.config import Settings

st.set_page_config(
    page_title="Wayfare — Personalized Travel Itinerary Planner",
    page_icon="✈️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom Styling
st.markdown(
    """
    <style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 700;
        color: #1E293B;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        font-size: 1.05rem;
        color: #64748B;
        margin-bottom: 1.5rem;
    }
    .metric-card {
        background-color: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        padding: 1rem;
        text-align: center;
    }
    .activity-badge {
        display: inline-block;
        padding: 0.2rem 0.6rem;
        font-size: 0.75rem;
        font-weight: 600;
        border-radius: 9999px;
        text-transform: uppercase;
        margin-left: 0.5rem;
    }
    .badge-attraction { background-color: #DBEAFE; color: #1D4ED8; }
    .badge-dining { background-color: #FEF3C7; color: #B45309; }
    .badge-transport { background-color: #E0E7FF; color: #4338CA; }
    .badge-activity { background-color: #DCFCE7; color: #15803D; }
    .badge-accommodation { background-color: #F3E8FF; color: #7E22CE; }
    </style>
    """,
    unsafe_allow_html=True,
)

# Header
st.markdown('<div class="main-header">✈️ Wayfare: Travel Itinerary Planner</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-header">AI-assisted smart trip builder — custom day-by-day itineraries, smart budgeting, and maps.</div>', unsafe_allow_html=True)

# Sidebar inputs
st.sidebar.header("🗺️ Plan Your Trip")

destination = st.sidebar.text_input("Destination", value="Tokyo, Japan", placeholder="e.g. Paris, France or Kyoto")

col_date1, col_date2 = st.sidebar.columns(2)
today = date.today()
default_start = today + timedelta(days=14)
default_end = default_start + timedelta(days=4)

start_date = col_date1.date_input("Start Date", value=default_start)
end_date = col_date2.date_input("End Date", value=default_end)

col_b1, col_b2 = st.sidebar.columns([2, 1])
budget = col_b1.number_input("Total Budget", min_value=100.0, value=2500.0, step=100.0)
currency = col_b2.selectbox("Currency", ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD"], index=0)

travelers = st.sidebar.number_input("Travelers", min_value=1, max_value=30, value=2)

col_s1, col_s2 = st.sidebar.columns(2)
travel_style = col_s1.selectbox("Travel Style", ["solo", "couple", "group", "family"], index=1)
pace = col_s2.selectbox("Pace", ["relaxed", "balanced", "packed"], index=1)

accommodation = st.sidebar.selectbox("Accommodation", ["budget", "comfort", "premium"], index=1)

ALL_INTERESTS = [
    "food", "sightseeing", "culture", "history", "adventure",
    "nature", "shopping", "nightlife", "relaxation", "art"
]
interests = st.sidebar.multiselect("Interests", ALL_INTERESTS, default=["food", "sightseeing", "culture"])

notes = st.sidebar.text_area("Notes / Specific Requests", placeholder="e.g., love sushi and historic shrines, avoid steep hills", max_chars=500)

st.sidebar.markdown("---")
st.sidebar.subheader("🤖 AI Integration (Optional)")
api_key = st.sidebar.text_input("Anthropic API Key", type="password", help="Leave blank to use the offline smart template planner.")
model_name = st.sidebar.selectbox("Model", ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"], index=0)

generate_btn = st.sidebar.button("✨ Generate Itinerary", type="primary", use_container_width=True)

# Helper function to generate maps search link
def get_maps_url(query: str, location: str) -> str:
    full_query = f"{query}, {location}" if location else query
    return f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(full_query)}"

# Activity badge class helper
def get_badge_class(activity_type: str) -> str:
    mapping = {
        "attraction": "badge-attraction",
        "dining": "badge-dining",
        "transport": "badge-transport",
        "activity": "badge-activity",
        "accommodation": "badge-accommodation",
    }
    return mapping.get(activity_type, "badge-activity")

# State management
if "itinerary" not in st.session_state:
    st.session_state.itinerary = None
if "prefs" not in st.session_state:
    st.session_state.prefs = None

if generate_btn:
    if end_date < start_date:
        st.error("Error: End Date cannot be before Start Date.")
    elif (end_date - start_date).days + 1 > 14:
        st.error("Error: Trips are limited to a maximum of 14 days.")
    elif not destination.strip():
        st.error("Error: Destination cannot be empty.")
    else:
        with st.spinner(f"Crafting your custom itinerary for {destination}..."):
            try:
                prefs = TripPreferences(
                    destination=destination.strip(),
                    start_date=start_date,
                    end_date=end_date,
                    budget=float(budget),
                    currency=currency,
                    travelers=int(travelers),
                    travel_style=travel_style,
                    pace=pace,
                    accommodation=accommodation,
                    interests=interests,
                    notes=notes.strip(),
                )
                settings = Settings(
                    anthropic_api_key=api_key.strip(),
                    anthropic_model=model_name,
                )
                generator = ItineraryGenerator(settings)
                itinerary = generator.generate(prefs)

                st.session_state.itinerary = itinerary
                st.session_state.prefs = prefs
                st.session_state.settings = settings
                st.success("🎉 Itinerary generated successfully!")
            except Exception as e:
                st.error(f"Failed to generate itinerary: {e}")

# Display Itinerary
if st.session_state.itinerary and st.session_state.prefs:
    itinerary = st.session_state.itinerary
    prefs = st.session_state.prefs

    st.markdown(f"### 📍 Trip to {prefs.destination}")
    st.info(f"**Summary:** {itinerary.summary}")

    if itinerary.generation_note:
        st.caption(f"ℹ️ {itinerary.generation_note}")

    # Top metrics
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.metric("Total Budget", f"{prefs.currency} {prefs.budget:,.2f}")
    with c2:
        diff = prefs.budget - itinerary.estimated_cost
        st.metric("Estimated Cost", f"{prefs.currency} {itinerary.estimated_cost:,.2f}", delta=f"{diff:+,.2f} buffer" if diff >= 0 else f"{diff:,.2f} over")
    with c3:
        st.metric("Duration", f"{prefs.num_days} Days")
    with c4:
        st.metric("Lodging Total", f"{prefs.currency} {itinerary.lodging_cost:,.2f}")

    st.markdown("---")

    # Lodging info
    if itinerary.lodging:
        with st.expander("🏨 Recommended Lodging", expanded=True):
            for lodge in itinerary.lodging:
                col_l1, col_l2 = st.columns([3, 1])
                with col_l1:
                    st.markdown(f"**{lodge.name}** ({lodge.area})")
                    if lodge.why:
                        st.caption(lodge.why)
                with col_l2:
                    st.markdown(f"**{prefs.currency} {lodge.price_per_night:,.2f}** / night")
                    st.caption(f"{lodge.nights} night(s)")

    # Day-by-Day schedule
    st.subheader("📅 Day-by-Day Itinerary")
    day_titles = [f"Day {d.day} ({d.date.strftime('%b %d') if d.date else ''})" for d in itinerary.days]
    day_tabs = st.tabs(day_titles)

    for idx, (tab, day) in enumerate(zip(day_tabs, itinerary.days)):
        with tab:
            st.markdown(f"#### {day.title or f'Day {day.day}'}")
            if day.theme:
                st.caption(f"Theme: **{day.theme}** | Estimated Day Cost: **{prefs.currency} {day.estimated_cost:,.2f}**")

            for act in day.activities:
                b_class = get_badge_class(act.type)
                maps_link = get_maps_url(act.title, act.location or prefs.destination)
                
                with st.container():
                    col_t, col_info, col_c = st.columns([1, 4, 1.5])
                    with col_t:
                        st.markdown(f"**⏰ {act.time}**")
                        if act.duration_minutes:
                            st.caption(f"{act.duration_minutes} min")
                    with col_info:
                        st.markdown(
                            f"**{act.title}** <span class='activity-badge {b_class}'>{act.type}</span>",
                            unsafe_allow_html=True,
                        )
                        if act.description:
                            st.write(act.description)
                        if act.transport_note:
                            st.caption(f"🚆 *Transport:* {act.transport_note}")
                        st.markdown(f"[📍 Open in Google Maps]({maps_link})")
                    with col_c:
                        if act.cost > 0:
                            st.markdown(f"**{prefs.currency} {act.cost:,.2f}**")
                        else:
                            st.caption("Included / Free")
                    st.markdown("<hr style='margin: 0.5rem 0; opacity: 0.3;'/>", unsafe_allow_html=True)

    # Tips section
    if itinerary.tips:
        with st.expander("💡 Helpful Travel Tips"):
            for tip in itinerary.tips:
                st.markdown(f"- {tip}")

    # Export Section
    st.markdown("---")
    st.subheader("📥 Export & Share")
    col_exp1, col_exp2 = st.columns(2)

    # Markdown Export
    md_lines = [
        f"# {prefs.destination} Travel Itinerary",
        f"**Dates:** {prefs.start_date} to {prefs.end_date} ({prefs.num_days} days)",
        f"**Budget:** {prefs.currency} {prefs.budget:,.2f} (Estimated: {prefs.currency} {itinerary.estimated_cost:,.2f})",
        f"**Travelers:** {prefs.travelers} | **Pace:** {prefs.pace} | **Style:** {prefs.travel_style}",
        f"\n## Summary\n{itinerary.summary}\n",
    ]
    for d in itinerary.days:
        md_lines.append(f"### {d.title or f'Day {d.day}'} ({d.date})")
        for a in d.activities:
            cost_str = f" - {prefs.currency} {a.cost:,.2f}" if a.cost else ""
            md_lines.append(f"- **{a.time}** {a.title} ({a.type}){cost_str}: {a.description}")
        md_lines.append("")

    markdown_content = "\n".join(md_lines)
    col_exp1.download_button(
        label="📄 Download Itinerary as Markdown",
        data=markdown_content,
        file_name=f"{prefs.destination.lower().replace(' ', '_')}_itinerary.md",
        mime="text/markdown",
        use_container_width=True,
    )

    # JSON Export
    json_content = json.dumps(
        {
            "preferences": prefs.model_dump(mode="json"),
            "itinerary": itinerary.model_dump(mode="json"),
        },
        indent=2,
    )
    col_exp2.download_button(
        label="💾 Download Itinerary as JSON",
        data=json_content,
        file_name=f"{prefs.destination.lower().replace(' ', '_')}_itinerary.json",
        mime="application/json",
        use_container_width=True,
    )

else:
    # Landing state guide
    st.info("👈 Enter your destination, budget, and travel preferences in the sidebar, then click **Generate Itinerary** to get started!")
