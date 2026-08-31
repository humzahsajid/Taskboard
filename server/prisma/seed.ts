/**
 * Seed data so the app is immediately usable after `docker compose up`.
 *
 * Safe to run repeatedly: it upserts the demo accounts and only builds the
 * sample board the first time (keyed on a marker board title for the demo user).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL ?? "demo@example.com";
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "demo1234";
const SAMPLE_BOARD_TITLE = "Product Roadmap (Sample)";

async function upsertUser(email: string, name: string, password: string, avatarColor: string) {
  return prisma.user.upsert({
    where: { email },
    update: { name, avatarColor },
    create: { email, name, avatarColor, passwordHash: await bcrypt.hash(password, 10) },
  });
}

async function main() {
  console.log("Seeding demo accounts...");
  const demo = await upsertUser(DEMO_EMAIL, "Demo User", DEMO_PASSWORD, "#6366f1");
  const alex = await upsertUser("alex@example.com", "Alex Rivera", "teammate123", "#0ea5e9");
  const sam = await upsertUser("sam@example.com", "Sam Chen", "teammate123", "#22c55e");

  const existing = await prisma.board.findFirst({
    where: { ownerId: demo.id, title: SAMPLE_BOARD_TITLE },
  });
  if (existing) {
    console.log("Sample board already present — nothing else to do.");
    return;
  }

  console.log("Creating sample board...");
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const board = await prisma.board.create({
    data: {
      title: SAMPLE_BOARD_TITLE,
      description: "A sample board showing lists, cards, labels, due dates, checklists and comments.",
      ownerId: demo.id,
      members: {
        create: [
          { userId: demo.id, role: "owner" },
          { userId: alex.id, role: "member" },
          { userId: sam.id, role: "member" },
        ],
      },
      labels: {
        create: [
          { name: "Bug", color: "#ef4444" },
          { name: "Feature", color: "#22c55e" },
          { name: "Urgent", color: "#f97316" },
          { name: "Design", color: "#a855f7" },
          { name: "Docs", color: "#0ea5e9" },
        ],
      },
      lists: {
        create: [
          { title: "Backlog", position: 1000 },
          { title: "In Progress", position: 2000 },
          { title: "Review", position: 3000 },
          { title: "Done", position: 4000 },
        ],
      },
    },
    include: { labels: true, lists: true },
  });

  const label = (name: string) => board.labels.find((l) => l.name === name)!;
  const list = (title: string) => board.lists.find((l) => l.title === title)!;

  async function addCard(opts: {
    listTitle: string;
    title: string;
    position: number;
    description?: string;
    dueInDays?: number;
    labels?: string[];
    assignees?: string[];
    comments?: { userId: string; body: string }[];
    checklist?: { title: string; items: [string, boolean][] };
  }) {
    const card = await prisma.card.create({
      data: {
        listId: list(opts.listTitle).id,
        title: opts.title,
        position: opts.position,
        description: opts.description ?? "",
        dueDate: opts.dueInDays !== undefined ? new Date(now + opts.dueInDays * day) : null,
        labels: opts.labels ? { create: opts.labels.map((n) => ({ labelId: label(n).id })) } : undefined,
        assignees: opts.assignees ? { create: opts.assignees.map((userId) => ({ userId })) } : undefined,
        comments: opts.comments ? { create: opts.comments } : undefined,
        checklists: opts.checklist
          ? {
              create: {
                title: opts.checklist.title,
                position: 1000,
                items: {
                  create: opts.checklist.items.map(([text, done], i) => ({
                    text,
                    done,
                    position: (i + 1) * 1000,
                  })),
                },
              },
            }
          : undefined,
      },
    });
    await prisma.activity.create({
      data: { boardId: board.id, cardId: card.id, userId: demo.id, type: "card.created", data: { title: opts.title } },
    });
    return card;
  }

  await addCard({
    listTitle: "Backlog",
    title: "Research competitor onboarding flows",
    position: 1000,
    description: "Look at how Trello, Asana and Linear onboard new users. Capture screenshots.",
    labels: ["Docs"],
    assignees: [sam.id],
    dueInDays: 6,
  });
  await addCard({
    listTitle: "Backlog",
    title: "Dark mode support",
    position: 2000,
    labels: ["Feature", "Design"],
    dueInDays: 20,
  });
  await addCard({
    listTitle: "In Progress",
    title: "Card drag-and-drop between lists",
    position: 1000,
    description: "Cards should move smoothly between lists and keep their order after refresh.",
    labels: ["Feature"],
    assignees: [demo.id, alex.id],
    dueInDays: 2,
    checklist: {
      title: "Acceptance criteria",
      items: [
        ["Drag within a list reorders cards", true],
        ["Drag across lists moves the card", true],
        ["Order persists after page reload", false],
        ["Works with touch on mobile", false],
      ],
    },
    comments: [
      { userId: alex.id, body: "Started on this — using @dnd-kit for accessibility." },
      { userId: demo.id, body: "Nice. Don't forget the mobile touch sensors." },
    ],
  });
  await addCard({
    listTitle: "In Progress",
    title: "Fix: due-date badge shows wrong colour when overdue",
    position: 2000,
    labels: ["Bug", "Urgent"],
    assignees: [alex.id],
    dueInDays: -1,
  });
  await addCard({
    listTitle: "Review",
    title: "REST API for boards, lists and cards",
    position: 1000,
    description: "Endpoints for boards, lists, cards, comments, labels, due dates and checklists.",
    labels: ["Feature"],
    assignees: [sam.id],
    comments: [{ userId: sam.id, body: "PR is up for review." }],
  });
  await addCard({
    listTitle: "Done",
    title: "Project scaffold + Docker Compose",
    position: 1000,
    labels: ["Docs"],
    assignees: [demo.id],
  });

  // A few extra activity entries so the history view looks realistic.
  const dndCard = await prisma.card.findFirst({ where: { title: { startsWith: "Card drag-and-drop" } } });
  if (dndCard) {
    await prisma.activity.createMany({
      data: [
        { boardId: board.id, cardId: dndCard.id, userId: alex.id, type: "card.moved", data: { from: "Backlog", to: "In Progress" } },
        { boardId: board.id, cardId: dndCard.id, userId: alex.id, type: "comment.added", data: { preview: "Started on this..." } },
        { boardId: board.id, cardId: dndCard.id, userId: demo.id, type: "checklist.item.completed", data: { text: "Drag within a list reorders cards" } },
      ],
    });
  }

  console.log("Seed complete.");
  console.log(`  Log in with:  ${DEMO_EMAIL}  /  ${DEMO_PASSWORD}`);
  console.log("  Teammates:    alex@example.com / sam@example.com  (password: teammate123)");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
