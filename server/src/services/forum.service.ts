import type { Server } from "socket.io";
import * as forumModel from "../models/forum.model";
import * as userModel from "../models/user.model";
import { createNotification } from "./notifications.service";

export async function listThreads(q?: string) {
  return forumModel.listThreads(q);
}

export async function createThread(title: string, body: string, authorId: string) {
  return forumModel.insertThread(title, body, authorId);
}

export async function getThreadWithPosts(threadId: string) {
  const thread = await forumModel.findThreadWithAuthor(threadId);
  if (!thread) return null;
  const posts = await forumModel.listPostsByThread(threadId);
  return { thread, posts };
}

export async function addPost(opts: {
  threadId: string;
  authorId: string;
  body: string;
  parentId?: string;
  io?: Server;
}) {
  const { threadId, authorId, body, parentId, io } = opts;

  const threadAuthorId = await forumModel.findThreadAuthorId(threadId);
  if (!threadAuthorId) return null;

  const post = await forumModel.insertPost(threadId, authorId, body, parentId ?? null);
  await forumModel.touchThreadUpdatedAt(threadId);

  const notifyThreadAuthor = threadAuthorId !== authorId;

  let parentAuthorId: string | null = null;
  if (parentId) {
    parentAuthorId = await forumModel.findPostAuthorId(parentId);
  }
  const notifyParentAuthor = !!parentAuthorId && parentAuthorId !== authorId && parentAuthorId !== threadAuthorId;

  if (notifyThreadAuthor || notifyParentAuthor) {
    const posterName = (await userModel.findDisplayName(authorId)) ?? "Ai đó";

    if (notifyThreadAuthor) {
      await createNotification({
        userId: threadAuthorId,
        type: "forum_reply",
        title: `${posterName} đã trả lời chủ đề của bạn`,
        body: body.slice(0, 100),
        refId: threadId,
        io,
      });
    }

    if (notifyParentAuthor && parentAuthorId) {
      await createNotification({
        userId: parentAuthorId,
        type: "forum_reply",
        title: `${posterName} đã trả lời bình luận của bạn`,
        body: body.slice(0, 100),
        refId: threadId,
        io,
      });
    }
  }

  return post;
}

export async function deletePost(postId: string, authorId: string) {
  return forumModel.deletePostByOwner(postId, authorId);
}
