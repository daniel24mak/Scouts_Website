import { HeartHandshake, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { useBootstrap } from "../api/useBootstrap.js";
import { contentImage, contentText } from "../services/siteContentService.js";

const goals = [
  ["Faith", "Growing through values, prayer, and connection to the church community."],
  ["Leadership", "Helping scouts build confidence, responsibility, and decision-making skills."],
  ["Teamwork", "Teaching scouts to work together, support one another, and build strong friendships."],
  ["Service", "Encouraging scouts to serve the church, the community, and those around them."],
  ["Discipline", "Building commitment, respect, responsibility, and self-control."],
  ["Character", "Helping every scout become honest, kind, brave, and dependable."]
];

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
  const { data } = useBootstrap();
  const siteContent = data.siteContent ?? {};
  const managedLeaders = data.leaders ?? [];
  const leaders = managedLeaders.length
    ? managedLeaders
    : data.users
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
  const aboutImage = contentImage(siteContent, "about_intro_image", "");

  return (
    <>
      <section className="about-intro public-section">
        <div className="about-intro-copy">
          <p className="eyebrow">About St. Mary's Scouts Dubai</p>
          <h1>A scouting family rooted in faith, service, and community.</h1>
          <p>{aboutIntro}</p>
          <p>
            We believe scouting helps children and youth become confident, disciplined, and
            caring individuals who are ready to serve their community and live with strong values.
          </p>
        </div>
        {aboutImage ? (
          <div className="public-image-card">
            <img src={aboutImage} alt="St. Mary's Scouts Dubai community activity" loading="lazy" />
          </div>
        ) : (
          <div className="about-intro-panel">
            <UsersRound size={42} aria-hidden="true" />
            <strong>St. Mary's Catholic Church, Dubai</strong>
            <span>Dubai, United Arab Emirates</span>
          </div>
        )}
      </section>

      <section className="public-section">
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
                <img src={leader.photoUrl} alt={`${leader.name}, ${leader.title ?? titleForLeader(leader)}`} loading="lazy" />
              ) : (
                <div className="leader-avatar">{initials(leader.name)}</div>
              )}
              <h3>{leader.name}</h3>
              <span>{leader.title ?? titleForLeader(leader)}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section split-section public-band">
        <div>
          <p className="eyebrow">Our Story</p>
          <h2>Growing through scouting values, faith, friendship, and service.</h2>
          <p>{historyText}</p>
          <p>
            Over the years, our scout group has continued to grow through weekly meetings,
            ceremonies, camps, church celebrations, teamwork activities, and community service.
            Each generation of scouts has helped carry forward the spirit of scouting with
            dedication, joy, and responsibility.
          </p>
        </div>
        <div className="values-panel">
          <HeartHandshake size={38} aria-hidden="true" />
          <strong>Faith and service in action</strong>
          <span>Connected to the parish, families, and the wider Dubai community.</span>
        </div>
      </section>

      <section className="public-section">
        <div className="mission-grid">
          <article>
            <Sparkles size={28} aria-hidden="true" />
            <h2>Our Mission</h2>
            <p>{missionText}</p>
          </article>
          <article>
            <ShieldCheck size={28} aria-hidden="true" />
            <h2>Our Vision</h2>
            <p>
              Our vision is to build a strong scouting family where every member feels welcomed,
              supported, and inspired to become a better leader, friend, and member of the community.
            </p>
          </article>
        </div>
      </section>

      <section className="public-section public-band">
        <p className="eyebrow">Our Goals</p>
        <h2>Values that shape our scouts.</h2>
        <div className="goal-grid">
          {goals.map(([title, text]) => (
            <article className="goal-card" key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
