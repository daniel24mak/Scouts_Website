import { Church, Compass, Flag, HeartHandshake, ShieldCheck, Sparkles, Star, Users, UsersRound } from "lucide-react";
import { useEffect } from "react";
import { getPublicAboutData } from "../api/publicClient.js";
import { usePublicData } from "../api/usePublicData.js";
import SafeImage from "../components/SafeImage.jsx";
import FormattedText from "../components/FormattedText.jsx";
import { scoutGroups } from "../data/groups.js";
import { contentImage, contentText } from "../services/siteContentService.js";
import { preloadImages } from "../utils/imagePreload.js";

const goals = [
  ["Faith", "Growing through values, prayer, and connection to the church community."],
  ["Leadership", "Helping scouts build confidence, responsibility, and decision-making skills."],
  ["Teamwork", "Teaching scouts to work together, support one another, and build strong friendships."],
  ["Service", "Encouraging scouts to serve the church, the community, and those around them."],
  ["Discipline", "Building commitment, respect, responsibility, and self-control."],
  ["Character", "Helping every scout become honest, kind, brave, and dependable."]
];

const valueIcons = { Church, Compass, Flag, HeartHandshake, ShieldCheck, Sparkles, Star, Users };

function groupRange(group) {
  if (group.assignmentBasis === "age") {
    return group.ageRange || group.gradeRange || "Group range to be announced";
  }

  return group.gradeRange || group.ageRange || "Group range to be announced";
}
function titleForLeader(user) {
  if (user.role === "admin" && user.chiefLevel === "head") {
    return "Group Leader";
  }

  if (user.chiefLevel === "head") {
    return "Head Chief";
  }

  if (user.chiefLevel === "vice") {
    return "Vice Head Chief";
  }

  if (user.role === "admin") {
    return "Group Admin";
  }

  return "Chief";
}

function parseHistoryMilestones(siteContent, fallbackText) {
  const raw = contentText(siteContent, "about_history_milestones", "").trim();

  if (!raw) {
    return [
      {
        year: "Story",
        title: "Our journey so far",
        text: fallbackText
      }
    ];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          year: String(item.year ?? "").trim(),
          title: String(item.title ?? "").trim(),
          text: String(item.text ?? item.description ?? "").trim()
        }))
        .filter((item) => item.year && item.title && item.text);
    }
  } catch {
    // Fall back to the simple line format below.
  }

  const milestones = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [year = "", title = "", ...rest] = line.split("|").map((part) => part.trim());
      return { year, title, text: rest.join("|").trim() };
    })
    .filter((item) => item.year && item.title && item.text);

  return milestones.length ? milestones : [
    {
      year: "Story",
      title: "Our journey so far",
      text: fallbackText
    }
  ];
}
function parseManagedList(siteContent, key, fallback) {
  const raw = contentText(siteContent, key, "").trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : fallback;
  } catch {
    return fallback;
  }
}
function initials(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function AboutPage() {
  const { data } = usePublicData(getPublicAboutData, [], { siteContent: {}, leaders: [], users: [] }, ["about"]);
  const siteContent = data?.siteContent ?? {};
  const managedLeaders = data?.leaders ?? [];
  const users = data?.users ?? [];
  const leaders = managedLeaders.length
    ? managedLeaders
    : users
        .filter((user) => user.role === "admin" || user.role === "chief" || user.groupId)
        .slice(0, 12);
  const aboutIntro = contentText(
    siteContent,
    "about_intro_text",
    "St. Mary's Scouts Dubai is a scouting group based at St. Mary's Catholic Church, Dubai. Our mission is to guide young people as they grow in faith, leadership, responsibility, teamwork, and service."
  );
  const historyText = contentText(
    siteContent,
    "about_history_text",
    "St. Mary's Scouts Dubai was created to give young people a place where they can grow through scouting values, faith, friendship, and service. From its beginning, the group has been connected to the church community and has worked to support children and youth through meaningful activities and leadership development."
  );
  const missionText = contentText(
    siteContent,
    "about_mission_text",
    "Our mission is to help young people grow into responsible, confident, faithful, and service-minded individuals through scouting activities, leadership opportunities, teamwork, and community involvement."
  );
  const heroImage = contentImage(siteContent, "about_hero_image", "");
  const aboutImage = contentImage(siteContent, "about_intro_image", "");
  const historyMilestones = parseHistoryMilestones(siteContent, historyText);
  const pageTitle = contentText(siteContent, "about_page_title", "About Us");
  const managedValues = parseManagedList(siteContent, "about_values", goals.map(([name, description], index) => ({ id: `value-${index}`, name, description })));
  const managedGroups = parseManagedList(siteContent, "about_scout_groups", scoutGroups.map((group) => ({ id: group.id, name: group.name, ageRange: groupRange(group), description: "" })));

  useEffect(() => {
    preloadImages([heroImage, aboutImage]);
  }, [heroImage, aboutImage]);

  return (
    <div className="about-page">
      <section className="about-hero public-hero" style={heroImage ? { "--hero-image": `url("${heroImage}")` } : undefined}>
        <div>
          <p className="eyebrow">St. Mary's Scouts Dubai</p>
          <h1>{pageTitle}</h1>
          <p>A scouting family rooted in faith, service, leadership, and community.</p>
        </div>
      </section>

      <section className="about-intro public-section">
        <div className="about-intro-copy">
          <p className="eyebrow">Our Story</p>
          <h2>Growing together through scouting values and friendship.</h2>
          <FormattedText text={aboutIntro} />
          <p>
            We believe scouting helps children and youth become confident, disciplined, and
            caring individuals who are ready to serve their community and live with strong values.
          </p>
        </div>
        {aboutImage ? (
          <div className="public-image-card">
            <SafeImage
              src={aboutImage}
              alt="St. Mary's Scouts Dubai community activity"
              loading="lazy"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        ) : (
          <div className="about-intro-panel">
            <UsersRound size={42} aria-hidden="true" />
            <strong>St. Mary's Catholic Church, Dubai</strong>
            <span>Dubai, United Arab Emirates</span>
          </div>
        )}
      </section>

      <section className="public-section about-history-section public-band">
        <div className="about-history-copy">
          <p className="eyebrow">Our History</p>
          <h2>Built through faith, friendship, and service.</h2>
          <FormattedText text={historyText} />
          <p>
            Over the years, our scout group has continued to grow through weekly meetings,
            ceremonies, camps, church celebrations, teamwork activities, and community service.
            Each generation of scouts has helped carry forward the spirit of scouting with
            dedication, joy, and responsibility.
          </p>
        </div>
        <div className="about-history-track" aria-label="History timeline milestones">
          <div className="about-history-timeline">
            {historyMilestones.map((milestone) => (
              <article key={`${milestone.year}-${milestone.title}`}>
                <span aria-hidden="true" />
                <strong>{milestone.year}</strong>
                <h3>{milestone.title}</h3>
                <p>{milestone.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section about-mission-section">
        <div className="about-mission-statement">
          <Sparkles size={28} aria-hidden="true" />
          <p className="eyebrow">Our Mission</p>
          <h2>Helping young people grow with purpose.</h2>
          <FormattedText text={missionText} />
        </div>
        <article className="about-vision-card">
          <ShieldCheck size={28} aria-hidden="true" />
          <h2>Our Vision</h2>
          <p>
            Our vision is to build a strong scouting family where every member feels welcomed,
            supported, and inspired to become a better leader, friend, and member of the community.
          </p>
        </article>
      </section>

      <section className="public-section public-band about-values-section">
        <p className="eyebrow">Our Values</p>
        <h2>Values that shape our scouts.</h2>
        <div className="goal-grid">
          {managedValues.map((value) => (
            <article className="goal-card" key={value.id ?? value.name}>
              <Compass size={26} aria-hidden="true" />
              <h3>{value.name}</h3>
              <p>{value.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section about-groups-section">
        <p className="eyebrow">Scout Groups</p>
        <h2>Every age has a place to grow.</h2>
        <div className="about-group-strip">
          {managedGroups.map((group) => (
            <article className="about-group-card" key={group.id ?? group.name}>
              <h3>{group.name}</h3>
              <span>{group.ageRange}</span>
              {group.description && <p>{group.description}</p>}
            </article>
          ))}
        </div>
      </section>

      <section className="public-section split-section public-band about-service-section">
        <div className="values-panel">
          <HeartHandshake size={38} aria-hidden="true" />
          <strong>Faith and service in action</strong>
          <span>Connected to the parish, families, and the wider Dubai community.</span>
        </div>
        <div>
          <p className="eyebrow">Community</p>
          <h2>Serving with joy and growing with purpose.</h2>
          <p>
            Our scouts learn by participating, helping, leading, and caring for others. Every
            activity is a chance to build confidence and strengthen the community around them.
          </p>
        </div>
      </section>

      <section className="public-section about-leaders-section">
        <p className="eyebrow">Our Leaders</p>
        <h2>Dedicated chiefs and volunteers guiding every scout.</h2>
        <p>
          Our leaders are dedicated chiefs and volunteers who guide, support, and inspire our
          scouts. Through their time, care, and commitment, they help create a safe and meaningful
          scouting experience for every member.
        </p>
        <div className="leaders-grid">
          {leaders.map((leader) => (
            <article className="leader-card" key={leader.id}>
              {leader.photoUrl ? (
                <SafeImage
                  src={leader.photoUrl}
                  alt={`${leader.name}, ${leader.title ?? titleForLeader(leader)}`}
                  loading="lazy"
                  sizes="(max-width: 768px) 50vw, 220px"
                />
              ) : (
                <div className="leader-avatar">{initials(leader.name)}</div>
              )}
              <h3>{leader.name}</h3>
              <span>{leader.title ?? titleForLeader(leader)}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
