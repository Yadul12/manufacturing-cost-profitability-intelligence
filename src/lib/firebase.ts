import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import blueprint from '../../firebase-blueprint.json';

// Initialize Firebase App & Firestore with explicit database ID
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Validate connection to Firestore on boot as required by firebase-integration-rpc
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Standardized Firestore Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validation Synchronicity Constants extracted verbatim from firebase-blueprint.json
const prodProps = blueprint.entities.ProductionRecord.properties;
const scenProps = blueprint.entities.SavedScenario.properties;
const optProps = blueprint.entities.OptimisationActionStatus.properties;

export const BLUEPRINT_CONSTRAINTS = {
  ID_MAX_LEN: prodProps.ownerId.maxLength,
  ID_REGEX: new RegExp(prodProps.ownerId.pattern),
  MONTH_REGEX: new RegExp(prodProps.month.pattern),
  PLANT_NAME_MAX_LEN: prodProps.plantName.maxLength,
  PRODUCT_NAME_MAX_LEN: prodProps.productName.maxLength,
  LINE_MAX_LEN: prodProps.productionLine.maxLength,
  SECTORS: prodProps.sector.enum,
  SCENARIO_NAME_MAX_LEN: scenProps.name.maxLength,
  SCENARIO_DESC_MAX_LEN: scenProps.description.maxLength,
  OPT_NOTE_MAX_LEN: optProps.ownerNote.maxLength,
  OPT_STATUSES: optProps.status.enum,
};

export function sanitizeString(val: string, maxLength: number): string {
  return String(val ?? '').trim().slice(0, maxLength);
}

export function validateIdFormat(id: string): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= BLUEPRINT_CONSTRAINTS.ID_MAX_LEN &&
    BLUEPRINT_CONSTRAINTS.ID_REGEX.test(id)
  );
}

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  return fbSignOut(auth);
}
