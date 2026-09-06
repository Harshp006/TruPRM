import { prisma } from '../lib/prisma';
import { Role } from '@prisma/client';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: string;
  relatedEntityId?: string;
}

export async function createNotification(input: CreateNotificationInput) {
  try {
    return await prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type || 'INFO',
        relatedEntityId: input.relatedEntityId || null,
        read: false,
      },
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
    return null;
  }
}

export async function createRoleNotification(roles: Role[], input: Omit<CreateNotificationInput, 'userId'>) {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: roles } },
      select: { id: true },
    });

    if (users.length === 0) return [];

    return await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title: input.title,
        message: input.message,
        type: input.type || 'INFO',
        relatedEntityId: input.relatedEntityId || null,
        read: false,
      })),
    });
  } catch (err) {
    console.error('Failed to create role notification:', err);
    return [];
  }
}
