// lib/auth.ts
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendMail } from './mail';

const JWT_SECRET = process.env.JWT_SECRET!;
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

// === Go'daki hata sabitlerine denk gelen string'ler ===
export const ErrEmailInUse = 'EMAIL_IN_USE';
export const ErrInvalidCredentials = 'INVALID_CREDENTIALS';
export const ErrNotVerified = 'NOT_VERIFIED';
export const ErrCodeInvalid = 'CODE_INVALID';

// Kodun geçerlilik süresi (Go'daki codeTTL gibi) - 1 saat
const CODE_TTL_MS = 60 * 60 * 1000;

if (!JWT_SECRET) {
  console.warn('JWT_SECRET env missing');
}

// 6 haneli doğrulama kodu
function randomCode(): string {
  const n = Math.floor(Math.random() * 900000) + 100000; // 100000–999999
  return n.toString();
}

// === REGISTER ===
// Go'daki Register mantığını bire bir kopyalıyoruz:
// - email normalize
// - kullanıcı yoksa → yeni user
// - kullanıcı varsa:
//    - verified=true → ErrEmailInUse
//    - verified=false → password + code + expires güncelle
export async function registerUser(email: string, password: string) {
  email = email.trim().toLowerCase();
  password = password.trim();

  if (!email || !password) {
    throw new Error('email and password required');
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  const code = randomCode();
  const expires = new Date(Date.now() + CODE_TTL_MS);
  const passwordHash = await bcrypt.hash(password, 10);

  if (!existing) {
    // yeni kullanıcı
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        isVerified: false,
        verificationCode: code,
        verificationExpiresAt: expires,
      },
    });
  } else {
    // kullanıcı var
    if (existing.isVerified) {
      // Go'da: u.Verified ise ErrEmailInUse
      throw new Error(ErrEmailInUse);
    }

    // verified=false ise password + code güncelliyoruz
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        verificationCode: code,
        verificationExpiresAt: expires,
        isVerified: false,
      },
    });
  }

  const verifyLink = `${APP_URL}/verify?email=${encodeURIComponent(
    email
  )}&code=${code}`;

  const html = `
    <p>Doğrulama kodunuz: <b>${code}</b></p>
    <p>Ya da aşağıdaki linke tıklayın:</p>
    <p><a href="${verifyLink}">${verifyLink}</a></p>
    <p>Kod ${CODE_TTL_MS / (60 * 1000)} dakika geçerlidir.</p>
  `;

  await sendMail(email, 'Doğrulama Kodunuz', html);
}

// === VERIFY ===
// Go'daki Verify:
// - user bulamazsa error
// - VerifyCode boş veya eşleşmiyorsa → "invalid code"
// - VerifyExpires geçmişse → "code expired"
export async function verifyUser(email: string, code: string) {
  email = email.trim().toLowerCase();
  code = code.trim();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('user not found');
  }

  if (!user.verificationCode || user.verificationCode !== code) {
    throw new Error('invalid code');
  }

  if (
    user.verificationExpiresAt &&
    user.verificationExpiresAt < new Date()
  ) {
    throw new Error('code expired');
  }

  await prisma.user.update({
    where: { email },
    data: {
      isVerified: true,
      verificationCode: null,
      verificationExpiresAt: null,
    },
  });
}

// === RESEND ===
// Go'daki Resend:
// - user yoksa "user not found"
// - verified=true ise ErrEmailInUse
// - aksi halde yeni code + expires + mail
export async function resendVerification(email: string) {
  email = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('user not found');
  }

  if (user.isVerified) {
    throw new Error(ErrEmailInUse);
  }

  const code = randomCode();
  const expires = new Date(Date.now() + CODE_TTL_MS);

  await prisma.user.update({
    where: { email },
    data: {
      verificationCode: code,
      verificationExpiresAt: expires,
    },
  });

  const verifyLink = `${APP_URL}/verify?email=${encodeURIComponent(
    email
  )}&code=${code}`;

  const html = `
    <p>Yeni doğrulama kodunuz: <b>${code}</b></p>
    <p>Ya da aşağıdaki linke tıklayın:</p>
    <p><a href="${verifyLink}">${verifyLink}</a></p>
  `;

  await sendMail(email, 'Yeni Doğrulama Kodunuz', html);
}

// === LOGIN ===
// Go'daki Login:
// - email'e göre user bulamazsa → ErrInvalidCredentials
// - şifre yanlışsa → ErrInvalidCredentials
// - verified değilse → ErrNotVerified
export async function loginUser(email: string, password: string) {
  email = email.trim().toLowerCase();
  password = password.trim();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(ErrInvalidCredentials);
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new Error(ErrInvalidCredentials);
  }

  if (!user.isVerified) {
    throw new Error(ErrNotVerified);
  }

  return user;
}

// === JWT ===
// Go'da IssueJWT: sub=email, exp, iat
export function issueJWT(email: string, ttl: number) {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + Math.floor(ttl / 1000);

  const payload: jwt.JwtPayload = {
    sub: email,
    iat: nowSec,
    exp: expSec,
  };

  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

// Go'daki ParseJWT: sub claim'den email döndürüyor
export function parseJWT(token: string): string {
  const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

  const sub = decoded.sub;
  if (typeof sub === 'string') {
    return sub;
  }

  throw new Error('bad claims');
}

// Ekstra: RandomPassword, şimdilik ihtiyacımız yok ama istersek ekleriz.
// Buraya istersen şu fonksiyonu da koyabiliriz:
//
// export function randomPassword(): string {
//   const buf = Buffer.alloc(18);
//   crypto.randomFillSync(buf);
//   return buf.toString('base64url');
// }