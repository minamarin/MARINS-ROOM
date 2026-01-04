import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create a sample admin user
  const admin = await prisma.user.upsert({
    where: { email: "marin@marinsroom.com" },
    update: {},
    create: {
      email: "marin@marinsroom.com",
      name: "Marin",
      isAdmin: true,
    },
  });

  console.log("Created admin user:", admin.email);

  // Create a sample video (READY status for testing)
  const video = await prisma.video.upsert({
    where: { storageKey: "sample-video-001" },
    update: {},
    create: {
      title: "Welcome to Marin's Room",
      description: "A sample video to test the platform",
      storageKey: "sample-video-001",
      playbackUrl: "https://example.com/videos/sample.mp4",
      status: "READY",
      mimeType: "video/mp4",
    },
  });

  console.log("Created sample video:", video.title);

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
