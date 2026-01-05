// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Her çalıştırmada temiz başlamak için:
  await prisma.session.deleteMany();
  await prisma.surveyResponse.deleteMany();
  await prisma.surveyQuestion.deleteMany();
  await prisma.survey.deleteMany();
  await prisma.videoProgress.deleteMany();
  await prisma.video.deleteMany();

  // 8 eğitim videosu
  const videosData = Array.from({ length: 8 }).map((_, idx) => {
    const order = idx + 1;
    return {
      order,
      title: `Eğitim Videosu ${order}`,
      description: `Evlilik öncesi riskli davranışlar eğitimi - Bölüm ${order}`,
      url: `https://example.com/videos/${order}.mp4`, // ileride gerçek URL gelecek
      durationSeconds: 600, // şimdilik 10 dk varsayalım
      isActive: true,
    };
  });

  await prisma.video.createMany({ data: videosData });
  console.log('Videolar eklendi ✅');

  // PRE, POST, FOLLOWUP anketleri
  const pre = await prisma.survey.create({
    data: {
      title: 'Ön Test Anketi',
      type: 'PRE',
      questions: {
        create: [
          { order: 1, text: 'Son 6 ayda korunmasız cinsel ilişkiniz oldu mu?' },
          { order: 2, text: 'Kondom kullanımına ilişkin bilginizi nasıl değerlendirirsiniz?' },
        ],
      },
    },
  });

  const post = await prisma.survey.create({
    data: {
      title: 'Son Test Anketi',
      type: 'POST',
      questions: {
        create: [
          { order: 1, text: 'Bu eğitim, riskli davranışlarınızı azaltmanızda etkili oldu mu?' },
          { order: 2, text: 'Eğitimde öğrendiklerinizi uygulamaya hazır hissediyor musunuz?' },
        ],
      },
    },
  });

  const followup = await prisma.survey.create({
    data: {
      title: '6 Ay Sonrası Takip Anketi',
      type: 'FOLLOWUP',
      questions: {
        create: [
          { order: 1, text: 'Eğitimden sonra cinsel davranışlarınızda değişiklik oldu mu?' },
          { order: 2, text: 'Bu eğitimi arkadaşlarınıza önerir misiniz?' },
        ],
      },
    },
  });
  // örnek: prisma/seed.ts
    const videos = await prisma.video.findMany({
    orderBy: { order: 'asc' },
    });

    for (const video of videos) {
    await prisma.survey.upsert({
        where: { videoId: video.id },
        update: {},
        create: {
        title: `Video ${video.order} Sonrası Anket`,
        type: 'VIDEO',
        videoId: video.id,
        },
    });
    }

    // follow-up tek bir anket:
    await prisma.survey.upsert({
    where: { id: 'followup-6-months' }, // key uydur
    update: {},
    create: {
        id: 'followup-6-months',
        title: '6 Ay Sonrası Anketi',
        type: 'FOLLOWUP',
    },
    });

  console.log('Anketler eklendi ✅');
  console.log('PRE id:', pre.id);
  console.log('POST id:', post.id);
  console.log('FOLLOWUP id:', followup.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });