export interface User {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
}

export interface Member extends User {
  role: "owner" | "member";
}

export interface Label {
  id: string;
  boardId: string;
  name: string;
  color: string;
}

export interface CardAssignee {
  id: string;
  name: string;
  avatarColor: string;
  email?: string;
}

export interface CardSummary {
  id: string;
  listId: string;
  title: string;
  description: string;
  position: number;
  dueDate: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  labels: Label[];
  assignees: CardAssignee[];
  commentCount: number;
  checklist: { total: number; done: number };
}

export interface ListWithCards {
  id: string;
  title: string;
  position: number;
  cards: CardSummary[];
}

export interface BoardDetail {
  id: string;
  title: string;
  description: string;
  archived: boolean;
  role: "owner" | "member";
  owner: User;
  members: Member[];
  labels: Label[];
  lists: ListWithCards[];
}

export interface BoardSummary {
  id: string;
  title: string;
  description: string;
  archived: boolean;
  owner: { id: string; name: string; avatarColor: string };
  isOwner: boolean;
  memberCount: number;
  listCount: number;
  updatedAt: string;
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; avatarColor: string };
}

export interface ChecklistItem {
  id: string;
  checklistId: string;
  text: string;
  done: boolean;
  position: number;
}

export interface Checklist {
  id: string;
  title: string;
  position: number;
  items: ChecklistItem[];
}

export interface CardDetail {
  id: string;
  listId: string;
  list: { id: string; title: string };
  boardId: string;
  title: string;
  description: string;
  position: number;
  dueDate: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  labels: Label[];
  assignees: CardAssignee[];
  comments: Comment[];
  checklists: Checklist[];
}

export interface Activity {
  id: string;
  boardId: string;
  cardId: string | null;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  user: { id: string; name: string; avatarColor: string };
  card?: { id: string; title: string } | null;
}
