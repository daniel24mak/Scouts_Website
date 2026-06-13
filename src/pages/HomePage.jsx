import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Images,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Newspaper,
  Phone,
  ShieldCheck,
  Users
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { sendContactMessage } from "../api/client.js";
import { useBootstrap } from "../api/useBootstrap.js";
import FadeInSection from "../components/FadeInSection.jsx";
import { contentImage, contentText } from "../services/siteContentService.js";

const activityCards = [
  ["Weekly Meetings", "Skills, patrol teamwork, games, and formation."],
  ["Scout Ceremonies", "Moments of promise, celebration, and commitment."],
  ["Outdoor Activities", "Camps, hikes, challenges, and practical learning."],
  ["Team Challenges", "Confidence, discipline, and friendship through action."],
  ["Church Events", "Serving and growing within St. Mary's community."],
  ["Community Service", "Helping scouts learn responsibility by serving others."]
];

function isPublicApprovedEvent(event) {
  return event.visibility === "public" && (event.approvalStatus ?? "approved") === "approved";
}

function getUpcomingEvents(events) {
  const today = new Date().toISOString().slice(0, 10);
  return events
    .filter((event) => isPublicApprovedEvent(event) && event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
}

function isApproved(content) {
  return (content.approvalStatus ?? content.status ?? "approved") === "approved";
}

export default function HomePage() {
  const { data, isLoading } = useBootstrap();
  const [openFaqId, setOpenFaqId] = useState(null);
  const [contactForm, setContactForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [contactStatus, setContactStatus] = useState({ type: "", message: "" });
  const [isSending, setIsSending] = useState(false);
  const siteContent = data.siteContent ?? {};
  const upcomingEvents = getUpcomingEvents(data.plannedEvents);
  const latestPosts = data.blogPosts.filter(isApproved).slice(0, 3);
  const galleryPreview = data.galleryAlbums.filter(isApproved).slice(0, 3);
  const activeFaqs = (data.faqs ?? []).filter((faq) => faq.isActive !== false);
  const heroImage = contentImage(siteContent, "home_hero_image", "");
  const aboutImage = contentImage(siteContent, "home_about_image", "");
  const heroTitle = contentText(
    siteContent,
    "home_hero_title",
    "Building Faith, Leadership, and Community Through Scouting"
  );
  const heroSubtitle = contentText(
    siteContent,
    "home_hero_subtitle",
    "Welcome to St. Mary's Scouts Dubai, a scouting family based at St. Mary's Catholic Church, Dubai. We help young people grow through faith, teamwork, discipline, service, and unforgettable scouting experiences."
  );
  const aboutText = contentText(
    siteContent,
    "home_about_text",
    "St. Mary's Scouts Dubai is a church-based scouting group connected to St. Mary's Catholic Church, Dubai. We bring together children and youth in a safe, supportive, and inspiring environment where they can learn leadership, responsibility, teamwork, and service."
  );
  const locationText = contentText(
    siteContent,
    "home_location_text",
    "Located at St. Mary's Catholic Church, Dubai, United Arab Emirates."
  );
  const getActivityImage = (index) =>
    contentImage(
      siteContent,
      `home_activity_image_${index + 1}`,
      ""
    );
  const handleContactSubmit = async (event) => {
    event.preventDefault();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.subject.trim() || !contactForm.message.trim()) {
      setContactStatus({ type: "error", message: "Please fill in all fields before sending." });
      return;
    }

    if (!emailPattern.test(contactForm.email)) {
      setContactStatus({ type: "error", message: "Please enter a valid email address." });
      return;
    }

    setIsSending(true);
    setContactStatus({ type: "", message: "" });

    try {
      await sendContactMessage(contactForm);
      setContactForm({ name: "", email: "", subject: "", message: "" });
      setContactStatus({ type: "success", message: "Thank you. Your message was sent successfully." });
    } catch (error) {
      setContactStatus({ type: "error", message: `Message could not be sent: ${error.message}` });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <FadeInSection className="home-hero public-hero" style={heroImage ? { "--hero-image": `url("${heroImage}")` } : undefined}>
        <div className="hero-copy">
          <p className="eyebrow">St. Mary's Scouts Dubai</p>
          <h1>{heroTitle}</h1>
          <p>{heroSubtitle}</p>
          <div className="hero-actions">
            <Link className="primary-action" to="/about">
              Learn About Us <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="secondary-action" to="/gallery">
              View Gallery
            </Link>
            <Link className="secondary-action" to="/blogs">
              Read News
            </Link>
          </div>
        </div>
      </FadeInSection>

      <FadeInSection className="public-section split-section">
        <div>
          <p className="eyebrow">Who We Are</p>
          <h2>Growing Together in Faith and Service</h2>
          <p>{aboutText}</p>
          <p>
            Through weekly meetings, activities, camps, ceremonies, and community events, our
            scouts grow in confidence, faith, friendship, and character.
          </p>
          <p className="location-line">
            <MapPin size={18} aria-hidden="true" />
            {locationText}
          </p>
          <Link className="inline-action" to="/about">
            Read More About Us
          </Link>
        </div>
        <div className="public-image-card">
          {aboutImage ? (
            <img src={aboutImage} alt="Scouts gathered at St. Mary's Scouts Dubai" loading="lazy" />
          ) : (
            <div className="image-fallback">
              <Users size={42} aria-hidden="true" />
              <span>Faith, friendship, and service</span>
            </div>
          )}
        </div>
      </FadeInSection>

      <FadeInSection className="public-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Life in Scouts</p>
            <h2>Learning by doing, serving with joy.</h2>
            <p>
              Scouting is more than meetings. It is learning by doing, growing through
              challenges, serving others, building friendships, and creating memories that last
              a lifetime.
            </p>
          </div>
        </div>
        <div className="activity-grid">
          {activityCards.map(([title, text], index) => {
            const activityImage = getActivityImage(index);

            return (
              <article className="activity-card" key={title}>
                {activityImage ? (
                  <img src={activityImage} alt={`${title} at St. Mary's Scouts Dubai`} loading="lazy" />
                ) : (
                  <div className="activity-icon">
                    <ShieldCheck size={26} aria-hidden="true" />
                  </div>
                )}
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            );
          })}
        </div>
      </FadeInSection>

      <FadeInSection className="public-section public-band">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Upcoming Events</p>
            <h2>What's happening next</h2>
            <p>
              Stay updated with our upcoming scout meetings, church events, ceremonies,
              activities, and special gatherings.
            </p>
          </div>
          <Link className="inline-action" to="/calendar">View All Events</Link>
        </div>
        <div className="event-preview-grid">
          {isLoading ? (
            <p className="empty-public-state">Loading upcoming events...</p>
          ) : upcomingEvents.length ? upcomingEvents.map((event) => (
            <article className="event-preview-card" key={event.id}>
              <span className="event-date-badge">
                <CalendarDays size={18} aria-hidden="true" />
                {event.date}
              </span>
              <h3>{event.title}</h3>
              <p>{event.description || "Public scout event."}</p>
              {(event.startTime || event.endTime) && <span>{[event.startTime, event.endTime].filter(Boolean).join(" - ")}</span>}
              <span>
                <MapPin size={16} aria-hidden="true" />
                {event.location || "St. Mary's Catholic Church, Dubai"}
              </span>
            </article>
          )) : (
            <p className="empty-public-state">No public events are available right now. Please check again soon.</p>
          )}
        </div>
      </FadeInSection>

      <FadeInSection className="public-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Latest News</p>
            <h2>Stories from our scouting community</h2>
            <p>Read the latest updates, announcements, activities, and stories from our scouting community.</p>
          </div>
          <Link className="inline-action" to="/blogs">Read More News</Link>
        </div>
        <div className="preview-card-grid">
          {isLoading ? (
            <p className="empty-public-state">Loading latest news...</p>
          ) : latestPosts.length ? latestPosts.map((post) => (
            <article className="preview-card" key={post.id}>
              <div className="preview-icon">
                <Newspaper size={26} aria-hidden="true" />
              </div>
              <span>{post.date}</span>
              <h3>{post.title}</h3>
              <p>{post.excerpt}</p>
              <Link to={`/blogs/${post.slug}`}>Read more</Link>
            </article>
          )) : (
            <p className="empty-public-state">No news posts are available right now.</p>
          )}
        </div>
      </FadeInSection>

      <FadeInSection className="public-section public-band">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Moments From Our Journey</p>
            <h2>Photos from meetings, camps, and ceremonies</h2>
            <p>Explore photos from our meetings, ceremonies, camps, activities, and special scout events.</p>
          </div>
          <Link className="inline-action" to="/gallery">View Gallery</Link>
        </div>
        <div className="gallery-preview-grid">
          {isLoading ? (
            <p className="empty-public-state">Loading gallery albums...</p>
          ) : galleryPreview.length ? galleryPreview.map((album) => (
            <Link className="gallery-preview-card" to={`/gallery/${album.id}`} key={album.id}>
              {album.photos[0]?.url ? (
                <img src={album.photos[0].url} alt={`${album.title} album cover`} loading="lazy" />
              ) : (
                <div className="image-fallback">
                  <Images size={32} aria-hidden="true" />
                </div>
              )}
              <div>
                <h3>{album.title}</h3>
                <span>{album.eventDate}</span>
              </div>
            </Link>
          )) : (
            <p className="empty-public-state">No gallery albums are available right now.</p>
          )}
        </div>
      </FadeInSection>

      <FadeInSection className="public-section faq-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2>Frequently Asked Questions</h2>
            <p>Quick answers for parents, scouts, chiefs, and volunteers.</p>
          </div>
        </div>
        <div className="faq-list">
          {isLoading ? (
            <p className="empty-public-state">Loading FAQs...</p>
          ) : activeFaqs.length ? activeFaqs.map((faq) => {
            const isOpen = openFaqId === faq.id;

            return (
              <article className={`faq-item ${isOpen ? "open" : ""}`} key={faq.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                >
                  <span>{faq.question}</span>
                  <ChevronDown size={20} aria-hidden="true" />
                </button>
                <div className="faq-answer">
                  <p>{faq.answer}</p>
                </div>
              </article>
            );
          }) : (
            <p className="empty-public-state">No FAQs are available right now.</p>
          )}
        </div>
      </FadeInSection>

      <FadeInSection className="public-section public-band contact-section">
        <div className="contact-layout">
          <div className="contact-info-card">
            <p className="eyebrow">Contact Us</p>
            <h2>Got any questions, suggestions, or want to volunteer?</h2>
            <p>
              We'd love to hear from you. Send us a message and our team will get back to you soon.
            </p>
            <div className="contact-info-list">
              <span><MapPin size={18} aria-hidden="true" /> St. Mary's Catholic Church, Dubai, United Arab Emirates</span>
              <span><Mail size={18} aria-hidden="true" /> Email placeholder</span>
              <span><Phone size={18} aria-hidden="true" /> Phone placeholder</span>
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
                <Instagram size={18} aria-hidden="true" /> Instagram
              </a>
              <span><MessageCircle size={18} aria-hidden="true" /> Meeting hours placeholder</span>
            </div>
          </div>
          <form className="contact-form" onSubmit={handleContactSubmit}>
            <label>
              Name
              <input
                required
                value={contactForm.name}
                onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                required
                value={contactForm.email}
                onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label>
              Subject
              <input
                required
                value={contactForm.subject}
                onChange={(event) => setContactForm((current) => ({ ...current, subject: event.target.value }))}
              />
            </label>
            <label>
              Message
              <textarea
                rows="5"
                required
                value={contactForm.message}
                onChange={(event) => setContactForm((current) => ({ ...current, message: event.target.value }))}
              />
            </label>
            {contactStatus.message && <p className={`form-status ${contactStatus.type}`}>{contactStatus.message}</p>}
            <button type="submit" disabled={isSending}>{isSending ? "Sending..." : "Send Message"}</button>
          </form>
        </div>
      </FadeInSection>
    </>
  );
}
