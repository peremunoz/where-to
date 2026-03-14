export type DatabaseEntity = 'institution' | 'building' | 'floor' | 'seat';

export type DatabaseAction = 'created' | 'updated' | 'deleted';

export interface DatabaseChangeEvent {
  id: string;
  timestamp: string;
  entity: DatabaseEntity;
  action: DatabaseAction;
  data: unknown;
}

export type PublishDatabaseChangeInput = Omit<
  DatabaseChangeEvent,
  'id' | 'timestamp'
>;
