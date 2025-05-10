export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  bigint: { input: any; output: any };
  jsonb: { input: any; output: any };
  numeric: { input: any; output: any };
  timestamptz: { input: any; output: any };
  uuid: { input: any; output: any };
};

/** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
export type Boolean_Comparison_Exp = {
  _eq?: InputMaybe<Scalars["Boolean"]["input"]>;
  _gt?: InputMaybe<Scalars["Boolean"]["input"]>;
  _gte?: InputMaybe<Scalars["Boolean"]["input"]>;
  _in?: InputMaybe<Array<Scalars["Boolean"]["input"]>>;
  _is_null?: InputMaybe<Scalars["Boolean"]["input"]>;
  _lt?: InputMaybe<Scalars["Boolean"]["input"]>;
  _lte?: InputMaybe<Scalars["Boolean"]["input"]>;
  _neq?: InputMaybe<Scalars["Boolean"]["input"]>;
  _nin?: InputMaybe<Array<Scalars["Boolean"]["input"]>>;
};

/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
export type Int_Comparison_Exp = {
  _eq?: InputMaybe<Scalars["Int"]["input"]>;
  _gt?: InputMaybe<Scalars["Int"]["input"]>;
  _gte?: InputMaybe<Scalars["Int"]["input"]>;
  _in?: InputMaybe<Array<Scalars["Int"]["input"]>>;
  _is_null?: InputMaybe<Scalars["Boolean"]["input"]>;
  _lt?: InputMaybe<Scalars["Int"]["input"]>;
  _lte?: InputMaybe<Scalars["Int"]["input"]>;
  _neq?: InputMaybe<Scalars["Int"]["input"]>;
  _nin?: InputMaybe<Array<Scalars["Int"]["input"]>>;
};

/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
export type String_Comparison_Exp = {
  _eq?: InputMaybe<Scalars["String"]["input"]>;
  _gt?: InputMaybe<Scalars["String"]["input"]>;
  _gte?: InputMaybe<Scalars["String"]["input"]>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: InputMaybe<Scalars["String"]["input"]>;
  _in?: InputMaybe<Array<Scalars["String"]["input"]>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: InputMaybe<Scalars["String"]["input"]>;
  _is_null?: InputMaybe<Scalars["Boolean"]["input"]>;
  /** does the column match the given pattern */
  _like?: InputMaybe<Scalars["String"]["input"]>;
  _lt?: InputMaybe<Scalars["String"]["input"]>;
  _lte?: InputMaybe<Scalars["String"]["input"]>;
  _neq?: InputMaybe<Scalars["String"]["input"]>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: InputMaybe<Scalars["String"]["input"]>;
  _nin?: InputMaybe<Array<Scalars["String"]["input"]>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: InputMaybe<Scalars["String"]["input"]>;
  /** does the column NOT match the given pattern */
  _nlike?: InputMaybe<Scalars["String"]["input"]>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: InputMaybe<Scalars["String"]["input"]>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: InputMaybe<Scalars["String"]["input"]>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: InputMaybe<Scalars["String"]["input"]>;
  /** does the column match the given SQL regular expression */
  _similar?: InputMaybe<Scalars["String"]["input"]>;
};

/** columns and relationships of "accounts" */
export type Accounts = {
  __typename?: "accounts";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  access_token?: Maybe<Scalars["String"]["output"]>;
  created_at: Scalars["timestamptz"]["output"];
  expires_at?: Maybe<Scalars["bigint"]["output"]>;
  /** An object relationship */
  hasyx?: Maybe<Hasyx>;
  id: Scalars["uuid"]["output"];
  id_token?: Maybe<Scalars["String"]["output"]>;
  oauth_token?: Maybe<Scalars["String"]["output"]>;
  oauth_token_secret?: Maybe<Scalars["String"]["output"]>;
  provider: Scalars["String"]["output"];
  provider_account_id: Scalars["String"]["output"];
  refresh_token?: Maybe<Scalars["String"]["output"]>;
  scope?: Maybe<Scalars["String"]["output"]>;
  session_state?: Maybe<Scalars["String"]["output"]>;
  token_type?: Maybe<Scalars["String"]["output"]>;
  type: Scalars["String"]["output"];
  /** An object relationship */
  user: Users;
  user_id: Scalars["uuid"]["output"];
};

/** aggregated selection of "accounts" */
export type Accounts_Aggregate = {
  __typename?: "accounts_aggregate";
  aggregate?: Maybe<Accounts_Aggregate_Fields>;
  nodes: Array<Accounts>;
};

export type Accounts_Aggregate_Bool_Exp = {
  count?: InputMaybe<Accounts_Aggregate_Bool_Exp_Count>;
};

export type Accounts_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Accounts_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
  filter?: InputMaybe<Accounts_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "accounts" */
export type Accounts_Aggregate_Fields = {
  __typename?: "accounts_aggregate_fields";
  avg?: Maybe<Accounts_Avg_Fields>;
  count: Scalars["Int"]["output"];
  max?: Maybe<Accounts_Max_Fields>;
  min?: Maybe<Accounts_Min_Fields>;
  stddev?: Maybe<Accounts_Stddev_Fields>;
  stddev_pop?: Maybe<Accounts_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Accounts_Stddev_Samp_Fields>;
  sum?: Maybe<Accounts_Sum_Fields>;
  var_pop?: Maybe<Accounts_Var_Pop_Fields>;
  var_samp?: Maybe<Accounts_Var_Samp_Fields>;
  variance?: Maybe<Accounts_Variance_Fields>;
};

/** aggregate fields of "accounts" */
export type Accounts_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Accounts_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** order by aggregate values of table "accounts" */
export type Accounts_Aggregate_Order_By = {
  avg?: InputMaybe<Accounts_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Accounts_Max_Order_By>;
  min?: InputMaybe<Accounts_Min_Order_By>;
  stddev?: InputMaybe<Accounts_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Accounts_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Accounts_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Accounts_Sum_Order_By>;
  var_pop?: InputMaybe<Accounts_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Accounts_Var_Samp_Order_By>;
  variance?: InputMaybe<Accounts_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "accounts" */
export type Accounts_Arr_Rel_Insert_Input = {
  data: Array<Accounts_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Accounts_On_Conflict>;
};

/** aggregate avg on columns */
export type Accounts_Avg_Fields = {
  __typename?: "accounts_avg_fields";
  expires_at?: Maybe<Scalars["Float"]["output"]>;
};

/** order by avg() on columns of table "accounts" */
export type Accounts_Avg_Order_By = {
  expires_at?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "accounts". All fields are combined with a logical 'AND'. */
export type Accounts_Bool_Exp = {
  _and?: InputMaybe<Array<Accounts_Bool_Exp>>;
  _hasyx_schema_name?: InputMaybe<String_Comparison_Exp>;
  _hasyx_table_name?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Accounts_Bool_Exp>;
  _or?: InputMaybe<Array<Accounts_Bool_Exp>>;
  access_token?: InputMaybe<String_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  expires_at?: InputMaybe<Bigint_Comparison_Exp>;
  hasyx?: InputMaybe<Hasyx_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  id_token?: InputMaybe<String_Comparison_Exp>;
  oauth_token?: InputMaybe<String_Comparison_Exp>;
  oauth_token_secret?: InputMaybe<String_Comparison_Exp>;
  provider?: InputMaybe<String_Comparison_Exp>;
  provider_account_id?: InputMaybe<String_Comparison_Exp>;
  refresh_token?: InputMaybe<String_Comparison_Exp>;
  scope?: InputMaybe<String_Comparison_Exp>;
  session_state?: InputMaybe<String_Comparison_Exp>;
  token_type?: InputMaybe<String_Comparison_Exp>;
  type?: InputMaybe<String_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  user_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "accounts" */
export enum Accounts_Constraint {
  /** unique or primary key constraint on columns "id" */
  AccountsPkey = "accounts_pkey",
  /** unique or primary key constraint on columns "provider", "provider_account_id" */
  AccountsProviderProviderAccountIdKey = "accounts_provider_provider_account_id_key",
}

/** input type for incrementing numeric columns in table "accounts" */
export type Accounts_Inc_Input = {
  expires_at?: InputMaybe<Scalars["bigint"]["input"]>;
};

/** input type for inserting data into table "accounts" */
export type Accounts_Insert_Input = {
  access_token?: InputMaybe<Scalars["String"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  expires_at?: InputMaybe<Scalars["bigint"]["input"]>;
  hasyx?: InputMaybe<Hasyx_Obj_Rel_Insert_Input>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  id_token?: InputMaybe<Scalars["String"]["input"]>;
  oauth_token?: InputMaybe<Scalars["String"]["input"]>;
  oauth_token_secret?: InputMaybe<Scalars["String"]["input"]>;
  provider?: InputMaybe<Scalars["String"]["input"]>;
  provider_account_id?: InputMaybe<Scalars["String"]["input"]>;
  refresh_token?: InputMaybe<Scalars["String"]["input"]>;
  scope?: InputMaybe<Scalars["String"]["input"]>;
  session_state?: InputMaybe<Scalars["String"]["input"]>;
  token_type?: InputMaybe<Scalars["String"]["input"]>;
  type?: InputMaybe<Scalars["String"]["input"]>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** aggregate max on columns */
export type Accounts_Max_Fields = {
  __typename?: "accounts_max_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  access_token?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  expires_at?: Maybe<Scalars["bigint"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  id_token?: Maybe<Scalars["String"]["output"]>;
  oauth_token?: Maybe<Scalars["String"]["output"]>;
  oauth_token_secret?: Maybe<Scalars["String"]["output"]>;
  provider?: Maybe<Scalars["String"]["output"]>;
  provider_account_id?: Maybe<Scalars["String"]["output"]>;
  refresh_token?: Maybe<Scalars["String"]["output"]>;
  scope?: Maybe<Scalars["String"]["output"]>;
  session_state?: Maybe<Scalars["String"]["output"]>;
  token_type?: Maybe<Scalars["String"]["output"]>;
  type?: Maybe<Scalars["String"]["output"]>;
  user_id?: Maybe<Scalars["uuid"]["output"]>;
};

/** order by max() on columns of table "accounts" */
export type Accounts_Max_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  access_token?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  expires_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  id_token?: InputMaybe<Order_By>;
  oauth_token?: InputMaybe<Order_By>;
  oauth_token_secret?: InputMaybe<Order_By>;
  provider?: InputMaybe<Order_By>;
  provider_account_id?: InputMaybe<Order_By>;
  refresh_token?: InputMaybe<Order_By>;
  scope?: InputMaybe<Order_By>;
  session_state?: InputMaybe<Order_By>;
  token_type?: InputMaybe<Order_By>;
  type?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Accounts_Min_Fields = {
  __typename?: "accounts_min_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  access_token?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  expires_at?: Maybe<Scalars["bigint"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  id_token?: Maybe<Scalars["String"]["output"]>;
  oauth_token?: Maybe<Scalars["String"]["output"]>;
  oauth_token_secret?: Maybe<Scalars["String"]["output"]>;
  provider?: Maybe<Scalars["String"]["output"]>;
  provider_account_id?: Maybe<Scalars["String"]["output"]>;
  refresh_token?: Maybe<Scalars["String"]["output"]>;
  scope?: Maybe<Scalars["String"]["output"]>;
  session_state?: Maybe<Scalars["String"]["output"]>;
  token_type?: Maybe<Scalars["String"]["output"]>;
  type?: Maybe<Scalars["String"]["output"]>;
  user_id?: Maybe<Scalars["uuid"]["output"]>;
};

/** order by min() on columns of table "accounts" */
export type Accounts_Min_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  access_token?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  expires_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  id_token?: InputMaybe<Order_By>;
  oauth_token?: InputMaybe<Order_By>;
  oauth_token_secret?: InputMaybe<Order_By>;
  provider?: InputMaybe<Order_By>;
  provider_account_id?: InputMaybe<Order_By>;
  refresh_token?: InputMaybe<Order_By>;
  scope?: InputMaybe<Order_By>;
  session_state?: InputMaybe<Order_By>;
  token_type?: InputMaybe<Order_By>;
  type?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "accounts" */
export type Accounts_Mutation_Response = {
  __typename?: "accounts_mutation_response";
  /** number of rows affected by the mutation */
  affected_rows: Scalars["Int"]["output"];
  /** data from the rows affected by the mutation */
  returning: Array<Accounts>;
};

/** input type for inserting object relation for remote table "accounts" */
export type Accounts_Obj_Rel_Insert_Input = {
  data: Accounts_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Accounts_On_Conflict>;
};

/** on_conflict condition type for table "accounts" */
export type Accounts_On_Conflict = {
  constraint: Accounts_Constraint;
  update_columns?: Array<Accounts_Update_Column>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};

/** Ordering options when selecting data from "accounts". */
export type Accounts_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  access_token?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  expires_at?: InputMaybe<Order_By>;
  hasyx?: InputMaybe<Hasyx_Order_By>;
  id?: InputMaybe<Order_By>;
  id_token?: InputMaybe<Order_By>;
  oauth_token?: InputMaybe<Order_By>;
  oauth_token_secret?: InputMaybe<Order_By>;
  provider?: InputMaybe<Order_By>;
  provider_account_id?: InputMaybe<Order_By>;
  refresh_token?: InputMaybe<Order_By>;
  scope?: InputMaybe<Order_By>;
  session_state?: InputMaybe<Order_By>;
  token_type?: InputMaybe<Order_By>;
  type?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: accounts */
export type Accounts_Pk_Columns_Input = {
  id: Scalars["uuid"]["input"];
};

/** select columns of table "accounts" */
export enum Accounts_Select_Column {
  /** column name */
  HasyxSchemaName = "_hasyx_schema_name",
  /** column name */
  HasyxTableName = "_hasyx_table_name",
  /** column name */
  AccessToken = "access_token",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  ExpiresAt = "expires_at",
  /** column name */
  Id = "id",
  /** column name */
  IdToken = "id_token",
  /** column name */
  OauthToken = "oauth_token",
  /** column name */
  OauthTokenSecret = "oauth_token_secret",
  /** column name */
  Provider = "provider",
  /** column name */
  ProviderAccountId = "provider_account_id",
  /** column name */
  RefreshToken = "refresh_token",
  /** column name */
  Scope = "scope",
  /** column name */
  SessionState = "session_state",
  /** column name */
  TokenType = "token_type",
  /** column name */
  Type = "type",
  /** column name */
  UserId = "user_id",
}

/** input type for updating data in table "accounts" */
export type Accounts_Set_Input = {
  access_token?: InputMaybe<Scalars["String"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  expires_at?: InputMaybe<Scalars["bigint"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  id_token?: InputMaybe<Scalars["String"]["input"]>;
  oauth_token?: InputMaybe<Scalars["String"]["input"]>;
  oauth_token_secret?: InputMaybe<Scalars["String"]["input"]>;
  provider?: InputMaybe<Scalars["String"]["input"]>;
  provider_account_id?: InputMaybe<Scalars["String"]["input"]>;
  refresh_token?: InputMaybe<Scalars["String"]["input"]>;
  scope?: InputMaybe<Scalars["String"]["input"]>;
  session_state?: InputMaybe<Scalars["String"]["input"]>;
  token_type?: InputMaybe<Scalars["String"]["input"]>;
  type?: InputMaybe<Scalars["String"]["input"]>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** aggregate stddev on columns */
export type Accounts_Stddev_Fields = {
  __typename?: "accounts_stddev_fields";
  expires_at?: Maybe<Scalars["Float"]["output"]>;
};

/** order by stddev() on columns of table "accounts" */
export type Accounts_Stddev_Order_By = {
  expires_at?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Accounts_Stddev_Pop_Fields = {
  __typename?: "accounts_stddev_pop_fields";
  expires_at?: Maybe<Scalars["Float"]["output"]>;
};

/** order by stddev_pop() on columns of table "accounts" */
export type Accounts_Stddev_Pop_Order_By = {
  expires_at?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Accounts_Stddev_Samp_Fields = {
  __typename?: "accounts_stddev_samp_fields";
  expires_at?: Maybe<Scalars["Float"]["output"]>;
};

/** order by stddev_samp() on columns of table "accounts" */
export type Accounts_Stddev_Samp_Order_By = {
  expires_at?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "accounts" */
export type Accounts_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Accounts_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Accounts_Stream_Cursor_Value_Input = {
  _hasyx_schema_name?: InputMaybe<Scalars["String"]["input"]>;
  _hasyx_table_name?: InputMaybe<Scalars["String"]["input"]>;
  access_token?: InputMaybe<Scalars["String"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  expires_at?: InputMaybe<Scalars["bigint"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  id_token?: InputMaybe<Scalars["String"]["input"]>;
  oauth_token?: InputMaybe<Scalars["String"]["input"]>;
  oauth_token_secret?: InputMaybe<Scalars["String"]["input"]>;
  provider?: InputMaybe<Scalars["String"]["input"]>;
  provider_account_id?: InputMaybe<Scalars["String"]["input"]>;
  refresh_token?: InputMaybe<Scalars["String"]["input"]>;
  scope?: InputMaybe<Scalars["String"]["input"]>;
  session_state?: InputMaybe<Scalars["String"]["input"]>;
  token_type?: InputMaybe<Scalars["String"]["input"]>;
  type?: InputMaybe<Scalars["String"]["input"]>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** aggregate sum on columns */
export type Accounts_Sum_Fields = {
  __typename?: "accounts_sum_fields";
  expires_at?: Maybe<Scalars["bigint"]["output"]>;
};

/** order by sum() on columns of table "accounts" */
export type Accounts_Sum_Order_By = {
  expires_at?: InputMaybe<Order_By>;
};

/** update columns of table "accounts" */
export enum Accounts_Update_Column {
  /** column name */
  AccessToken = "access_token",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  ExpiresAt = "expires_at",
  /** column name */
  Id = "id",
  /** column name */
  IdToken = "id_token",
  /** column name */
  OauthToken = "oauth_token",
  /** column name */
  OauthTokenSecret = "oauth_token_secret",
  /** column name */
  Provider = "provider",
  /** column name */
  ProviderAccountId = "provider_account_id",
  /** column name */
  RefreshToken = "refresh_token",
  /** column name */
  Scope = "scope",
  /** column name */
  SessionState = "session_state",
  /** column name */
  TokenType = "token_type",
  /** column name */
  Type = "type",
  /** column name */
  UserId = "user_id",
}

export type Accounts_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Accounts_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Accounts_Set_Input>;
  /** filter the rows which have to be updated */
  where: Accounts_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Accounts_Var_Pop_Fields = {
  __typename?: "accounts_var_pop_fields";
  expires_at?: Maybe<Scalars["Float"]["output"]>;
};

/** order by var_pop() on columns of table "accounts" */
export type Accounts_Var_Pop_Order_By = {
  expires_at?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Accounts_Var_Samp_Fields = {
  __typename?: "accounts_var_samp_fields";
  expires_at?: Maybe<Scalars["Float"]["output"]>;
};

/** order by var_samp() on columns of table "accounts" */
export type Accounts_Var_Samp_Order_By = {
  expires_at?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Accounts_Variance_Fields = {
  __typename?: "accounts_variance_fields";
  expires_at?: Maybe<Scalars["Float"]["output"]>;
};

/** order by variance() on columns of table "accounts" */
export type Accounts_Variance_Order_By = {
  expires_at?: InputMaybe<Order_By>;
};

/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
export type Bigint_Comparison_Exp = {
  _eq?: InputMaybe<Scalars["bigint"]["input"]>;
  _gt?: InputMaybe<Scalars["bigint"]["input"]>;
  _gte?: InputMaybe<Scalars["bigint"]["input"]>;
  _in?: InputMaybe<Array<Scalars["bigint"]["input"]>>;
  _is_null?: InputMaybe<Scalars["Boolean"]["input"]>;
  _lt?: InputMaybe<Scalars["bigint"]["input"]>;
  _lte?: InputMaybe<Scalars["bigint"]["input"]>;
  _neq?: InputMaybe<Scalars["bigint"]["input"]>;
  _nin?: InputMaybe<Array<Scalars["bigint"]["input"]>>;
};

/** ordering argument of a cursor */
export enum Cursor_Ordering {
  /** ascending ordering of the cursor */
  Asc = "ASC",
  /** descending ordering of the cursor */
  Desc = "DESC",
}

/** columns and relationships of "debug" */
export type Debug = {
  __typename?: "debug";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  created_at: Scalars["timestamptz"]["output"];
  /** An object relationship */
  hasyx?: Maybe<Hasyx>;
  id: Scalars["uuid"]["output"];
  value?: Maybe<Scalars["jsonb"]["output"]>;
};

/** columns and relationships of "debug" */
export type DebugValueArgs = {
  path?: InputMaybe<Scalars["String"]["input"]>;
};

/** aggregated selection of "debug" */
export type Debug_Aggregate = {
  __typename?: "debug_aggregate";
  aggregate?: Maybe<Debug_Aggregate_Fields>;
  nodes: Array<Debug>;
};

/** aggregate fields of "debug" */
export type Debug_Aggregate_Fields = {
  __typename?: "debug_aggregate_fields";
  count: Scalars["Int"]["output"];
  max?: Maybe<Debug_Max_Fields>;
  min?: Maybe<Debug_Min_Fields>;
};

/** aggregate fields of "debug" */
export type Debug_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Debug_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Debug_Append_Input = {
  value?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** Boolean expression to filter rows from the table "debug". All fields are combined with a logical 'AND'. */
export type Debug_Bool_Exp = {
  _and?: InputMaybe<Array<Debug_Bool_Exp>>;
  _hasyx_schema_name?: InputMaybe<String_Comparison_Exp>;
  _hasyx_table_name?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Debug_Bool_Exp>;
  _or?: InputMaybe<Array<Debug_Bool_Exp>>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  hasyx?: InputMaybe<Hasyx_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  value?: InputMaybe<Jsonb_Comparison_Exp>;
};

/** unique or primary key constraints on table "debug" */
export enum Debug_Constraint {
  /** unique or primary key constraint on columns "id" */
  DebugPkey = "debug_pkey",
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Debug_Delete_At_Path_Input = {
  value?: InputMaybe<Array<Scalars["String"]["input"]>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Debug_Delete_Elem_Input = {
  value?: InputMaybe<Scalars["Int"]["input"]>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Debug_Delete_Key_Input = {
  value?: InputMaybe<Scalars["String"]["input"]>;
};

/** input type for inserting data into table "debug" */
export type Debug_Insert_Input = {
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  hasyx?: InputMaybe<Hasyx_Obj_Rel_Insert_Input>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  value?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** aggregate max on columns */
export type Debug_Max_Fields = {
  __typename?: "debug_max_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
};

/** aggregate min on columns */
export type Debug_Min_Fields = {
  __typename?: "debug_min_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
};

/** response of any mutation on the table "debug" */
export type Debug_Mutation_Response = {
  __typename?: "debug_mutation_response";
  /** number of rows affected by the mutation */
  affected_rows: Scalars["Int"]["output"];
  /** data from the rows affected by the mutation */
  returning: Array<Debug>;
};

/** input type for inserting object relation for remote table "debug" */
export type Debug_Obj_Rel_Insert_Input = {
  data: Debug_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Debug_On_Conflict>;
};

/** on_conflict condition type for table "debug" */
export type Debug_On_Conflict = {
  constraint: Debug_Constraint;
  update_columns?: Array<Debug_Update_Column>;
  where?: InputMaybe<Debug_Bool_Exp>;
};

/** Ordering options when selecting data from "debug". */
export type Debug_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  hasyx?: InputMaybe<Hasyx_Order_By>;
  id?: InputMaybe<Order_By>;
  value?: InputMaybe<Order_By>;
};

/** primary key columns input for table: debug */
export type Debug_Pk_Columns_Input = {
  id: Scalars["uuid"]["input"];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Debug_Prepend_Input = {
  value?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** select columns of table "debug" */
export enum Debug_Select_Column {
  /** column name */
  HasyxSchemaName = "_hasyx_schema_name",
  /** column name */
  HasyxTableName = "_hasyx_table_name",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  Id = "id",
  /** column name */
  Value = "value",
}

/** input type for updating data in table "debug" */
export type Debug_Set_Input = {
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  value?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** Streaming cursor of the table "debug" */
export type Debug_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Debug_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Debug_Stream_Cursor_Value_Input = {
  _hasyx_schema_name?: InputMaybe<Scalars["String"]["input"]>;
  _hasyx_table_name?: InputMaybe<Scalars["String"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  value?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** update columns of table "debug" */
export enum Debug_Update_Column {
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  Id = "id",
  /** column name */
  Value = "value",
}

export type Debug_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Debug_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Debug_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Debug_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Debug_Delete_Key_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Debug_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Debug_Set_Input>;
  /** filter the rows which have to be updated */
  where: Debug_Bool_Exp;
};

/** columns and relationships of "hasyx" */
export type Hasyx = {
  __typename?: "hasyx";
  hid?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["String"]["output"]>;
  namespace?: Maybe<Scalars["String"]["output"]>;
  project?: Maybe<Scalars["String"]["output"]>;
  /** An object relationship */
  public_accounts?: Maybe<Accounts>;
  /** An object relationship */
  public_debug?: Maybe<Debug>;
  /** An object relationship */
  public_notification_messages?: Maybe<Notification_Messages>;
  /** An object relationship */
  public_notification_permissions?: Maybe<Notification_Permissions>;
  /** An object relationship */
  public_notifications?: Maybe<Notifications>;
  /** An object relationship */
  public_payment_methods?: Maybe<Payment_Methods>;
  /** An object relationship */
  public_payments?: Maybe<Payments>;
  /** An object relationship */
  public_subscription_plans?: Maybe<Subscription_Plans>;
  /** An object relationship */
  public_subscriptions?: Maybe<Subscriptions>;
  /** An object relationship */
  public_users?: Maybe<Users>;
  schema?: Maybe<Scalars["String"]["output"]>;
  table?: Maybe<Scalars["String"]["output"]>;
};

/** aggregated selection of "hasyx" */
export type Hasyx_Aggregate = {
  __typename?: "hasyx_aggregate";
  aggregate?: Maybe<Hasyx_Aggregate_Fields>;
  nodes: Array<Hasyx>;
};

/** aggregate fields of "hasyx" */
export type Hasyx_Aggregate_Fields = {
  __typename?: "hasyx_aggregate_fields";
  count: Scalars["Int"]["output"];
  max?: Maybe<Hasyx_Max_Fields>;
  min?: Maybe<Hasyx_Min_Fields>;
};

/** aggregate fields of "hasyx" */
export type Hasyx_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Hasyx_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** Boolean expression to filter rows from the table "hasyx". All fields are combined with a logical 'AND'. */
export type Hasyx_Bool_Exp = {
  _and?: InputMaybe<Array<Hasyx_Bool_Exp>>;
  _not?: InputMaybe<Hasyx_Bool_Exp>;
  _or?: InputMaybe<Array<Hasyx_Bool_Exp>>;
  hid?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  namespace?: InputMaybe<String_Comparison_Exp>;
  project?: InputMaybe<String_Comparison_Exp>;
  public_accounts?: InputMaybe<Accounts_Bool_Exp>;
  public_debug?: InputMaybe<Debug_Bool_Exp>;
  public_notification_messages?: InputMaybe<Notification_Messages_Bool_Exp>;
  public_notification_permissions?: InputMaybe<Notification_Permissions_Bool_Exp>;
  public_notifications?: InputMaybe<Notifications_Bool_Exp>;
  public_payment_methods?: InputMaybe<Payment_Methods_Bool_Exp>;
  public_payments?: InputMaybe<Payments_Bool_Exp>;
  public_subscription_plans?: InputMaybe<Subscription_Plans_Bool_Exp>;
  public_subscriptions?: InputMaybe<Subscriptions_Bool_Exp>;
  public_users?: InputMaybe<Users_Bool_Exp>;
  schema?: InputMaybe<String_Comparison_Exp>;
  table?: InputMaybe<String_Comparison_Exp>;
};

/** input type for inserting data into table "hasyx" */
export type Hasyx_Insert_Input = {
  hid?: InputMaybe<Scalars["String"]["input"]>;
  id?: InputMaybe<Scalars["String"]["input"]>;
  namespace?: InputMaybe<Scalars["String"]["input"]>;
  project?: InputMaybe<Scalars["String"]["input"]>;
  public_accounts?: InputMaybe<Accounts_Obj_Rel_Insert_Input>;
  public_debug?: InputMaybe<Debug_Obj_Rel_Insert_Input>;
  public_notification_messages?: InputMaybe<Notification_Messages_Obj_Rel_Insert_Input>;
  public_notification_permissions?: InputMaybe<Notification_Permissions_Obj_Rel_Insert_Input>;
  public_notifications?: InputMaybe<Notifications_Obj_Rel_Insert_Input>;
  public_payment_methods?: InputMaybe<Payment_Methods_Obj_Rel_Insert_Input>;
  public_payments?: InputMaybe<Payments_Obj_Rel_Insert_Input>;
  public_subscription_plans?: InputMaybe<Subscription_Plans_Obj_Rel_Insert_Input>;
  public_subscriptions?: InputMaybe<Subscriptions_Obj_Rel_Insert_Input>;
  public_users?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  schema?: InputMaybe<Scalars["String"]["input"]>;
  table?: InputMaybe<Scalars["String"]["input"]>;
};

/** aggregate max on columns */
export type Hasyx_Max_Fields = {
  __typename?: "hasyx_max_fields";
  hid?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["String"]["output"]>;
  namespace?: Maybe<Scalars["String"]["output"]>;
  project?: Maybe<Scalars["String"]["output"]>;
  schema?: Maybe<Scalars["String"]["output"]>;
  table?: Maybe<Scalars["String"]["output"]>;
};

/** aggregate min on columns */
export type Hasyx_Min_Fields = {
  __typename?: "hasyx_min_fields";
  hid?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["String"]["output"]>;
  namespace?: Maybe<Scalars["String"]["output"]>;
  project?: Maybe<Scalars["String"]["output"]>;
  schema?: Maybe<Scalars["String"]["output"]>;
  table?: Maybe<Scalars["String"]["output"]>;
};

/** input type for inserting object relation for remote table "hasyx" */
export type Hasyx_Obj_Rel_Insert_Input = {
  data: Hasyx_Insert_Input;
};

/** Ordering options when selecting data from "hasyx". */
export type Hasyx_Order_By = {
  hid?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  namespace?: InputMaybe<Order_By>;
  project?: InputMaybe<Order_By>;
  public_accounts?: InputMaybe<Accounts_Order_By>;
  public_debug?: InputMaybe<Debug_Order_By>;
  public_notification_messages?: InputMaybe<Notification_Messages_Order_By>;
  public_notification_permissions?: InputMaybe<Notification_Permissions_Order_By>;
  public_notifications?: InputMaybe<Notifications_Order_By>;
  public_payment_methods?: InputMaybe<Payment_Methods_Order_By>;
  public_payments?: InputMaybe<Payments_Order_By>;
  public_subscription_plans?: InputMaybe<Subscription_Plans_Order_By>;
  public_subscriptions?: InputMaybe<Subscriptions_Order_By>;
  public_users?: InputMaybe<Users_Order_By>;
  schema?: InputMaybe<Order_By>;
  table?: InputMaybe<Order_By>;
};

/** select columns of table "hasyx" */
export enum Hasyx_Select_Column {
  /** column name */
  Hid = "hid",
  /** column name */
  Id = "id",
  /** column name */
  Namespace = "namespace",
  /** column name */
  Project = "project",
  /** column name */
  Schema = "schema",
  /** column name */
  Table = "table",
}

/** Streaming cursor of the table "hasyx" */
export type Hasyx_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Hasyx_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Hasyx_Stream_Cursor_Value_Input = {
  hid?: InputMaybe<Scalars["String"]["input"]>;
  id?: InputMaybe<Scalars["String"]["input"]>;
  namespace?: InputMaybe<Scalars["String"]["input"]>;
  project?: InputMaybe<Scalars["String"]["input"]>;
  schema?: InputMaybe<Scalars["String"]["input"]>;
  table?: InputMaybe<Scalars["String"]["input"]>;
};

export type Jsonb_Cast_Exp = {
  String?: InputMaybe<String_Comparison_Exp>;
};

/** Boolean expression to compare columns of type "jsonb". All fields are combined with logical 'AND'. */
export type Jsonb_Comparison_Exp = {
  _cast?: InputMaybe<Jsonb_Cast_Exp>;
  /** is the column contained in the given json value */
  _contained_in?: InputMaybe<Scalars["jsonb"]["input"]>;
  /** does the column contain the given json value at the top level */
  _contains?: InputMaybe<Scalars["jsonb"]["input"]>;
  _eq?: InputMaybe<Scalars["jsonb"]["input"]>;
  _gt?: InputMaybe<Scalars["jsonb"]["input"]>;
  _gte?: InputMaybe<Scalars["jsonb"]["input"]>;
  /** does the string exist as a top-level key in the column */
  _has_key?: InputMaybe<Scalars["String"]["input"]>;
  /** do all of these strings exist as top-level keys in the column */
  _has_keys_all?: InputMaybe<Array<Scalars["String"]["input"]>>;
  /** do any of these strings exist as top-level keys in the column */
  _has_keys_any?: InputMaybe<Array<Scalars["String"]["input"]>>;
  _in?: InputMaybe<Array<Scalars["jsonb"]["input"]>>;
  _is_null?: InputMaybe<Scalars["Boolean"]["input"]>;
  _lt?: InputMaybe<Scalars["jsonb"]["input"]>;
  _lte?: InputMaybe<Scalars["jsonb"]["input"]>;
  _neq?: InputMaybe<Scalars["jsonb"]["input"]>;
  _nin?: InputMaybe<Array<Scalars["jsonb"]["input"]>>;
};

/** mutation root */
export type Mutation_Root = {
  __typename?: "mutation_root";
  /** delete data from the table: "accounts" */
  delete_accounts?: Maybe<Accounts_Mutation_Response>;
  /** delete single row from the table: "accounts" */
  delete_accounts_by_pk?: Maybe<Accounts>;
  /** delete data from the table: "debug" */
  delete_debug?: Maybe<Debug_Mutation_Response>;
  /** delete single row from the table: "debug" */
  delete_debug_by_pk?: Maybe<Debug>;
  /** delete data from the table: "notification_messages" */
  delete_notification_messages?: Maybe<Notification_Messages_Mutation_Response>;
  /** delete single row from the table: "notification_messages" */
  delete_notification_messages_by_pk?: Maybe<Notification_Messages>;
  /** delete data from the table: "notification_permissions" */
  delete_notification_permissions?: Maybe<Notification_Permissions_Mutation_Response>;
  /** delete single row from the table: "notification_permissions" */
  delete_notification_permissions_by_pk?: Maybe<Notification_Permissions>;
  /** delete data from the table: "notifications" */
  delete_notifications?: Maybe<Notifications_Mutation_Response>;
  /** delete single row from the table: "notifications" */
  delete_notifications_by_pk?: Maybe<Notifications>;
  /** delete data from the table: "payment_methods" */
  delete_payment_methods?: Maybe<Payment_Methods_Mutation_Response>;
  /** delete single row from the table: "payment_methods" */
  delete_payment_methods_by_pk?: Maybe<Payment_Methods>;
  /** delete data from the table: "payments" */
  delete_payments?: Maybe<Payments_Mutation_Response>;
  /** delete single row from the table: "payments" */
  delete_payments_by_pk?: Maybe<Payments>;
  /** delete data from the table: "subscription_plans" */
  delete_subscription_plans?: Maybe<Subscription_Plans_Mutation_Response>;
  /** delete single row from the table: "subscription_plans" */
  delete_subscription_plans_by_pk?: Maybe<Subscription_Plans>;
  /** delete data from the table: "subscriptions" */
  delete_subscriptions?: Maybe<Subscriptions_Mutation_Response>;
  /** delete single row from the table: "subscriptions" */
  delete_subscriptions_by_pk?: Maybe<Subscriptions>;
  /** delete data from the table: "users" */
  delete_users?: Maybe<Users_Mutation_Response>;
  /** delete single row from the table: "users" */
  delete_users_by_pk?: Maybe<Users>;
  /** insert data into the table: "accounts" */
  insert_accounts?: Maybe<Accounts_Mutation_Response>;
  /** insert a single row into the table: "accounts" */
  insert_accounts_one?: Maybe<Accounts>;
  /** insert data into the table: "debug" */
  insert_debug?: Maybe<Debug_Mutation_Response>;
  /** insert a single row into the table: "debug" */
  insert_debug_one?: Maybe<Debug>;
  /** insert data into the table: "notification_messages" */
  insert_notification_messages?: Maybe<Notification_Messages_Mutation_Response>;
  /** insert a single row into the table: "notification_messages" */
  insert_notification_messages_one?: Maybe<Notification_Messages>;
  /** insert data into the table: "notification_permissions" */
  insert_notification_permissions?: Maybe<Notification_Permissions_Mutation_Response>;
  /** insert a single row into the table: "notification_permissions" */
  insert_notification_permissions_one?: Maybe<Notification_Permissions>;
  /** insert data into the table: "notifications" */
  insert_notifications?: Maybe<Notifications_Mutation_Response>;
  /** insert a single row into the table: "notifications" */
  insert_notifications_one?: Maybe<Notifications>;
  /** insert data into the table: "payment_methods" */
  insert_payment_methods?: Maybe<Payment_Methods_Mutation_Response>;
  /** insert a single row into the table: "payment_methods" */
  insert_payment_methods_one?: Maybe<Payment_Methods>;
  /** insert data into the table: "payments" */
  insert_payments?: Maybe<Payments_Mutation_Response>;
  /** insert a single row into the table: "payments" */
  insert_payments_one?: Maybe<Payments>;
  /** insert data into the table: "subscription_plans" */
  insert_subscription_plans?: Maybe<Subscription_Plans_Mutation_Response>;
  /** insert a single row into the table: "subscription_plans" */
  insert_subscription_plans_one?: Maybe<Subscription_Plans>;
  /** insert data into the table: "subscriptions" */
  insert_subscriptions?: Maybe<Subscriptions_Mutation_Response>;
  /** insert a single row into the table: "subscriptions" */
  insert_subscriptions_one?: Maybe<Subscriptions>;
  /** insert data into the table: "users" */
  insert_users?: Maybe<Users_Mutation_Response>;
  /** insert a single row into the table: "users" */
  insert_users_one?: Maybe<Users>;
  /** update data of the table: "accounts" */
  update_accounts?: Maybe<Accounts_Mutation_Response>;
  /** update single row of the table: "accounts" */
  update_accounts_by_pk?: Maybe<Accounts>;
  /** update multiples rows of table: "accounts" */
  update_accounts_many?: Maybe<Array<Maybe<Accounts_Mutation_Response>>>;
  /** update data of the table: "debug" */
  update_debug?: Maybe<Debug_Mutation_Response>;
  /** update single row of the table: "debug" */
  update_debug_by_pk?: Maybe<Debug>;
  /** update multiples rows of table: "debug" */
  update_debug_many?: Maybe<Array<Maybe<Debug_Mutation_Response>>>;
  /** update data of the table: "notification_messages" */
  update_notification_messages?: Maybe<Notification_Messages_Mutation_Response>;
  /** update single row of the table: "notification_messages" */
  update_notification_messages_by_pk?: Maybe<Notification_Messages>;
  /** update multiples rows of table: "notification_messages" */
  update_notification_messages_many?: Maybe<
    Array<Maybe<Notification_Messages_Mutation_Response>>
  >;
  /** update data of the table: "notification_permissions" */
  update_notification_permissions?: Maybe<Notification_Permissions_Mutation_Response>;
  /** update single row of the table: "notification_permissions" */
  update_notification_permissions_by_pk?: Maybe<Notification_Permissions>;
  /** update multiples rows of table: "notification_permissions" */
  update_notification_permissions_many?: Maybe<
    Array<Maybe<Notification_Permissions_Mutation_Response>>
  >;
  /** update data of the table: "notifications" */
  update_notifications?: Maybe<Notifications_Mutation_Response>;
  /** update single row of the table: "notifications" */
  update_notifications_by_pk?: Maybe<Notifications>;
  /** update multiples rows of table: "notifications" */
  update_notifications_many?: Maybe<
    Array<Maybe<Notifications_Mutation_Response>>
  >;
  /** update data of the table: "payment_methods" */
  update_payment_methods?: Maybe<Payment_Methods_Mutation_Response>;
  /** update single row of the table: "payment_methods" */
  update_payment_methods_by_pk?: Maybe<Payment_Methods>;
  /** update multiples rows of table: "payment_methods" */
  update_payment_methods_many?: Maybe<
    Array<Maybe<Payment_Methods_Mutation_Response>>
  >;
  /** update data of the table: "payments" */
  update_payments?: Maybe<Payments_Mutation_Response>;
  /** update single row of the table: "payments" */
  update_payments_by_pk?: Maybe<Payments>;
  /** update multiples rows of table: "payments" */
  update_payments_many?: Maybe<Array<Maybe<Payments_Mutation_Response>>>;
  /** update data of the table: "subscription_plans" */
  update_subscription_plans?: Maybe<Subscription_Plans_Mutation_Response>;
  /** update single row of the table: "subscription_plans" */
  update_subscription_plans_by_pk?: Maybe<Subscription_Plans>;
  /** update multiples rows of table: "subscription_plans" */
  update_subscription_plans_many?: Maybe<
    Array<Maybe<Subscription_Plans_Mutation_Response>>
  >;
  /** update data of the table: "subscriptions" */
  update_subscriptions?: Maybe<Subscriptions_Mutation_Response>;
  /** update single row of the table: "subscriptions" */
  update_subscriptions_by_pk?: Maybe<Subscriptions>;
  /** update multiples rows of table: "subscriptions" */
  update_subscriptions_many?: Maybe<
    Array<Maybe<Subscriptions_Mutation_Response>>
  >;
  /** update data of the table: "users" */
  update_users?: Maybe<Users_Mutation_Response>;
  /** update single row of the table: "users" */
  update_users_by_pk?: Maybe<Users>;
  /** update multiples rows of table: "users" */
  update_users_many?: Maybe<Array<Maybe<Users_Mutation_Response>>>;
};

/** mutation root */
export type Mutation_RootDelete_AccountsArgs = {
  where: Accounts_Bool_Exp;
};

/** mutation root */
export type Mutation_RootDelete_Accounts_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

/** mutation root */
export type Mutation_RootDelete_DebugArgs = {
  where: Debug_Bool_Exp;
};

/** mutation root */
export type Mutation_RootDelete_Debug_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

/** mutation root */
export type Mutation_RootDelete_Notification_MessagesArgs = {
  where: Notification_Messages_Bool_Exp;
};

/** mutation root */
export type Mutation_RootDelete_Notification_Messages_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

/** mutation root */
export type Mutation_RootDelete_Notification_PermissionsArgs = {
  where: Notification_Permissions_Bool_Exp;
};

/** mutation root */
export type Mutation_RootDelete_Notification_Permissions_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

/** mutation root */
export type Mutation_RootDelete_NotificationsArgs = {
  where: Notifications_Bool_Exp;
};

/** mutation root */
export type Mutation_RootDelete_Notifications_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

/** mutation root */
export type Mutation_RootDelete_Payment_MethodsArgs = {
  where: Payment_Methods_Bool_Exp;
};

/** mutation root */
export type Mutation_RootDelete_Payment_Methods_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

/** mutation root */
export type Mutation_RootDelete_PaymentsArgs = {
  where: Payments_Bool_Exp;
};

/** mutation root */
export type Mutation_RootDelete_Payments_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

/** mutation root */
export type Mutation_RootDelete_Subscription_PlansArgs = {
  where: Subscription_Plans_Bool_Exp;
};

/** mutation root */
export type Mutation_RootDelete_Subscription_Plans_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

/** mutation root */
export type Mutation_RootDelete_SubscriptionsArgs = {
  where: Subscriptions_Bool_Exp;
};

/** mutation root */
export type Mutation_RootDelete_Subscriptions_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

/** mutation root */
export type Mutation_RootDelete_UsersArgs = {
  where: Users_Bool_Exp;
};

/** mutation root */
export type Mutation_RootDelete_Users_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

/** mutation root */
export type Mutation_RootInsert_AccountsArgs = {
  objects: Array<Accounts_Insert_Input>;
  on_conflict?: InputMaybe<Accounts_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_Accounts_OneArgs = {
  object: Accounts_Insert_Input;
  on_conflict?: InputMaybe<Accounts_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_DebugArgs = {
  objects: Array<Debug_Insert_Input>;
  on_conflict?: InputMaybe<Debug_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_Debug_OneArgs = {
  object: Debug_Insert_Input;
  on_conflict?: InputMaybe<Debug_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_Notification_MessagesArgs = {
  objects: Array<Notification_Messages_Insert_Input>;
  on_conflict?: InputMaybe<Notification_Messages_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_Notification_Messages_OneArgs = {
  object: Notification_Messages_Insert_Input;
  on_conflict?: InputMaybe<Notification_Messages_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_Notification_PermissionsArgs = {
  objects: Array<Notification_Permissions_Insert_Input>;
  on_conflict?: InputMaybe<Notification_Permissions_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_Notification_Permissions_OneArgs = {
  object: Notification_Permissions_Insert_Input;
  on_conflict?: InputMaybe<Notification_Permissions_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_NotificationsArgs = {
  objects: Array<Notifications_Insert_Input>;
  on_conflict?: InputMaybe<Notifications_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_Notifications_OneArgs = {
  object: Notifications_Insert_Input;
  on_conflict?: InputMaybe<Notifications_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_Payment_MethodsArgs = {
  objects: Array<Payment_Methods_Insert_Input>;
  on_conflict?: InputMaybe<Payment_Methods_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_Payment_Methods_OneArgs = {
  object: Payment_Methods_Insert_Input;
  on_conflict?: InputMaybe<Payment_Methods_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_PaymentsArgs = {
  objects: Array<Payments_Insert_Input>;
  on_conflict?: InputMaybe<Payments_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_Payments_OneArgs = {
  object: Payments_Insert_Input;
  on_conflict?: InputMaybe<Payments_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_Subscription_PlansArgs = {
  objects: Array<Subscription_Plans_Insert_Input>;
  on_conflict?: InputMaybe<Subscription_Plans_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_Subscription_Plans_OneArgs = {
  object: Subscription_Plans_Insert_Input;
  on_conflict?: InputMaybe<Subscription_Plans_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_SubscriptionsArgs = {
  objects: Array<Subscriptions_Insert_Input>;
  on_conflict?: InputMaybe<Subscriptions_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_Subscriptions_OneArgs = {
  object: Subscriptions_Insert_Input;
  on_conflict?: InputMaybe<Subscriptions_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_UsersArgs = {
  objects: Array<Users_Insert_Input>;
  on_conflict?: InputMaybe<Users_On_Conflict>;
};

/** mutation root */
export type Mutation_RootInsert_Users_OneArgs = {
  object: Users_Insert_Input;
  on_conflict?: InputMaybe<Users_On_Conflict>;
};

/** mutation root */
export type Mutation_RootUpdate_AccountsArgs = {
  _inc?: InputMaybe<Accounts_Inc_Input>;
  _set?: InputMaybe<Accounts_Set_Input>;
  where: Accounts_Bool_Exp;
};

/** mutation root */
export type Mutation_RootUpdate_Accounts_By_PkArgs = {
  _inc?: InputMaybe<Accounts_Inc_Input>;
  _set?: InputMaybe<Accounts_Set_Input>;
  pk_columns: Accounts_Pk_Columns_Input;
};

/** mutation root */
export type Mutation_RootUpdate_Accounts_ManyArgs = {
  updates: Array<Accounts_Updates>;
};

/** mutation root */
export type Mutation_RootUpdate_DebugArgs = {
  _append?: InputMaybe<Debug_Append_Input>;
  _delete_at_path?: InputMaybe<Debug_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Debug_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Debug_Delete_Key_Input>;
  _prepend?: InputMaybe<Debug_Prepend_Input>;
  _set?: InputMaybe<Debug_Set_Input>;
  where: Debug_Bool_Exp;
};

/** mutation root */
export type Mutation_RootUpdate_Debug_By_PkArgs = {
  _append?: InputMaybe<Debug_Append_Input>;
  _delete_at_path?: InputMaybe<Debug_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Debug_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Debug_Delete_Key_Input>;
  _prepend?: InputMaybe<Debug_Prepend_Input>;
  _set?: InputMaybe<Debug_Set_Input>;
  pk_columns: Debug_Pk_Columns_Input;
};

/** mutation root */
export type Mutation_RootUpdate_Debug_ManyArgs = {
  updates: Array<Debug_Updates>;
};

/** mutation root */
export type Mutation_RootUpdate_Notification_MessagesArgs = {
  _append?: InputMaybe<Notification_Messages_Append_Input>;
  _delete_at_path?: InputMaybe<Notification_Messages_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Notification_Messages_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Notification_Messages_Delete_Key_Input>;
  _prepend?: InputMaybe<Notification_Messages_Prepend_Input>;
  _set?: InputMaybe<Notification_Messages_Set_Input>;
  where: Notification_Messages_Bool_Exp;
};

/** mutation root */
export type Mutation_RootUpdate_Notification_Messages_By_PkArgs = {
  _append?: InputMaybe<Notification_Messages_Append_Input>;
  _delete_at_path?: InputMaybe<Notification_Messages_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Notification_Messages_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Notification_Messages_Delete_Key_Input>;
  _prepend?: InputMaybe<Notification_Messages_Prepend_Input>;
  _set?: InputMaybe<Notification_Messages_Set_Input>;
  pk_columns: Notification_Messages_Pk_Columns_Input;
};

/** mutation root */
export type Mutation_RootUpdate_Notification_Messages_ManyArgs = {
  updates: Array<Notification_Messages_Updates>;
};

/** mutation root */
export type Mutation_RootUpdate_Notification_PermissionsArgs = {
  _append?: InputMaybe<Notification_Permissions_Append_Input>;
  _delete_at_path?: InputMaybe<Notification_Permissions_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Notification_Permissions_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Notification_Permissions_Delete_Key_Input>;
  _prepend?: InputMaybe<Notification_Permissions_Prepend_Input>;
  _set?: InputMaybe<Notification_Permissions_Set_Input>;
  where: Notification_Permissions_Bool_Exp;
};

/** mutation root */
export type Mutation_RootUpdate_Notification_Permissions_By_PkArgs = {
  _append?: InputMaybe<Notification_Permissions_Append_Input>;
  _delete_at_path?: InputMaybe<Notification_Permissions_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Notification_Permissions_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Notification_Permissions_Delete_Key_Input>;
  _prepend?: InputMaybe<Notification_Permissions_Prepend_Input>;
  _set?: InputMaybe<Notification_Permissions_Set_Input>;
  pk_columns: Notification_Permissions_Pk_Columns_Input;
};

/** mutation root */
export type Mutation_RootUpdate_Notification_Permissions_ManyArgs = {
  updates: Array<Notification_Permissions_Updates>;
};

/** mutation root */
export type Mutation_RootUpdate_NotificationsArgs = {
  _append?: InputMaybe<Notifications_Append_Input>;
  _delete_at_path?: InputMaybe<Notifications_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Notifications_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Notifications_Delete_Key_Input>;
  _prepend?: InputMaybe<Notifications_Prepend_Input>;
  _set?: InputMaybe<Notifications_Set_Input>;
  where: Notifications_Bool_Exp;
};

/** mutation root */
export type Mutation_RootUpdate_Notifications_By_PkArgs = {
  _append?: InputMaybe<Notifications_Append_Input>;
  _delete_at_path?: InputMaybe<Notifications_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Notifications_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Notifications_Delete_Key_Input>;
  _prepend?: InputMaybe<Notifications_Prepend_Input>;
  _set?: InputMaybe<Notifications_Set_Input>;
  pk_columns: Notifications_Pk_Columns_Input;
};

/** mutation root */
export type Mutation_RootUpdate_Notifications_ManyArgs = {
  updates: Array<Notifications_Updates>;
};

/** mutation root */
export type Mutation_RootUpdate_Payment_MethodsArgs = {
  _append?: InputMaybe<Payment_Methods_Append_Input>;
  _delete_at_path?: InputMaybe<Payment_Methods_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Payment_Methods_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Payment_Methods_Delete_Key_Input>;
  _prepend?: InputMaybe<Payment_Methods_Prepend_Input>;
  _set?: InputMaybe<Payment_Methods_Set_Input>;
  where: Payment_Methods_Bool_Exp;
};

/** mutation root */
export type Mutation_RootUpdate_Payment_Methods_By_PkArgs = {
  _append?: InputMaybe<Payment_Methods_Append_Input>;
  _delete_at_path?: InputMaybe<Payment_Methods_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Payment_Methods_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Payment_Methods_Delete_Key_Input>;
  _prepend?: InputMaybe<Payment_Methods_Prepend_Input>;
  _set?: InputMaybe<Payment_Methods_Set_Input>;
  pk_columns: Payment_Methods_Pk_Columns_Input;
};

/** mutation root */
export type Mutation_RootUpdate_Payment_Methods_ManyArgs = {
  updates: Array<Payment_Methods_Updates>;
};

/** mutation root */
export type Mutation_RootUpdate_PaymentsArgs = {
  _append?: InputMaybe<Payments_Append_Input>;
  _delete_at_path?: InputMaybe<Payments_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Payments_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Payments_Delete_Key_Input>;
  _inc?: InputMaybe<Payments_Inc_Input>;
  _prepend?: InputMaybe<Payments_Prepend_Input>;
  _set?: InputMaybe<Payments_Set_Input>;
  where: Payments_Bool_Exp;
};

/** mutation root */
export type Mutation_RootUpdate_Payments_By_PkArgs = {
  _append?: InputMaybe<Payments_Append_Input>;
  _delete_at_path?: InputMaybe<Payments_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Payments_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Payments_Delete_Key_Input>;
  _inc?: InputMaybe<Payments_Inc_Input>;
  _prepend?: InputMaybe<Payments_Prepend_Input>;
  _set?: InputMaybe<Payments_Set_Input>;
  pk_columns: Payments_Pk_Columns_Input;
};

/** mutation root */
export type Mutation_RootUpdate_Payments_ManyArgs = {
  updates: Array<Payments_Updates>;
};

/** mutation root */
export type Mutation_RootUpdate_Subscription_PlansArgs = {
  _append?: InputMaybe<Subscription_Plans_Append_Input>;
  _delete_at_path?: InputMaybe<Subscription_Plans_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Subscription_Plans_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Subscription_Plans_Delete_Key_Input>;
  _inc?: InputMaybe<Subscription_Plans_Inc_Input>;
  _prepend?: InputMaybe<Subscription_Plans_Prepend_Input>;
  _set?: InputMaybe<Subscription_Plans_Set_Input>;
  where: Subscription_Plans_Bool_Exp;
};

/** mutation root */
export type Mutation_RootUpdate_Subscription_Plans_By_PkArgs = {
  _append?: InputMaybe<Subscription_Plans_Append_Input>;
  _delete_at_path?: InputMaybe<Subscription_Plans_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Subscription_Plans_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Subscription_Plans_Delete_Key_Input>;
  _inc?: InputMaybe<Subscription_Plans_Inc_Input>;
  _prepend?: InputMaybe<Subscription_Plans_Prepend_Input>;
  _set?: InputMaybe<Subscription_Plans_Set_Input>;
  pk_columns: Subscription_Plans_Pk_Columns_Input;
};

/** mutation root */
export type Mutation_RootUpdate_Subscription_Plans_ManyArgs = {
  updates: Array<Subscription_Plans_Updates>;
};

/** mutation root */
export type Mutation_RootUpdate_SubscriptionsArgs = {
  _append?: InputMaybe<Subscriptions_Append_Input>;
  _delete_at_path?: InputMaybe<Subscriptions_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Subscriptions_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Subscriptions_Delete_Key_Input>;
  _prepend?: InputMaybe<Subscriptions_Prepend_Input>;
  _set?: InputMaybe<Subscriptions_Set_Input>;
  where: Subscriptions_Bool_Exp;
};

/** mutation root */
export type Mutation_RootUpdate_Subscriptions_By_PkArgs = {
  _append?: InputMaybe<Subscriptions_Append_Input>;
  _delete_at_path?: InputMaybe<Subscriptions_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Subscriptions_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Subscriptions_Delete_Key_Input>;
  _prepend?: InputMaybe<Subscriptions_Prepend_Input>;
  _set?: InputMaybe<Subscriptions_Set_Input>;
  pk_columns: Subscriptions_Pk_Columns_Input;
};

/** mutation root */
export type Mutation_RootUpdate_Subscriptions_ManyArgs = {
  updates: Array<Subscriptions_Updates>;
};

/** mutation root */
export type Mutation_RootUpdate_UsersArgs = {
  _set?: InputMaybe<Users_Set_Input>;
  where: Users_Bool_Exp;
};

/** mutation root */
export type Mutation_RootUpdate_Users_By_PkArgs = {
  _set?: InputMaybe<Users_Set_Input>;
  pk_columns: Users_Pk_Columns_Input;
};

/** mutation root */
export type Mutation_RootUpdate_Users_ManyArgs = {
  updates: Array<Users_Updates>;
};

/** columns and relationships of "notification_messages" */
export type Notification_Messages = {
  __typename?: "notification_messages";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  body: Scalars["String"]["output"];
  created_at: Scalars["timestamptz"]["output"];
  data?: Maybe<Scalars["jsonb"]["output"]>;
  /** An object relationship */
  hasyx?: Maybe<Hasyx>;
  id: Scalars["uuid"]["output"];
  /** An array relationship */
  notifications: Array<Notifications>;
  /** An aggregate relationship */
  notifications_aggregate: Notifications_Aggregate;
  title: Scalars["String"]["output"];
  /** An object relationship */
  user: Users;
  user_id: Scalars["uuid"]["output"];
};

/** columns and relationships of "notification_messages" */
export type Notification_MessagesDataArgs = {
  path?: InputMaybe<Scalars["String"]["input"]>;
};

/** columns and relationships of "notification_messages" */
export type Notification_MessagesNotificationsArgs = {
  distinct_on?: InputMaybe<Array<Notifications_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notifications_Order_By>>;
  where?: InputMaybe<Notifications_Bool_Exp>;
};

/** columns and relationships of "notification_messages" */
export type Notification_MessagesNotifications_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Notifications_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notifications_Order_By>>;
  where?: InputMaybe<Notifications_Bool_Exp>;
};

/** aggregated selection of "notification_messages" */
export type Notification_Messages_Aggregate = {
  __typename?: "notification_messages_aggregate";
  aggregate?: Maybe<Notification_Messages_Aggregate_Fields>;
  nodes: Array<Notification_Messages>;
};

export type Notification_Messages_Aggregate_Bool_Exp = {
  count?: InputMaybe<Notification_Messages_Aggregate_Bool_Exp_Count>;
};

export type Notification_Messages_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Notification_Messages_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
  filter?: InputMaybe<Notification_Messages_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "notification_messages" */
export type Notification_Messages_Aggregate_Fields = {
  __typename?: "notification_messages_aggregate_fields";
  count: Scalars["Int"]["output"];
  max?: Maybe<Notification_Messages_Max_Fields>;
  min?: Maybe<Notification_Messages_Min_Fields>;
};

/** aggregate fields of "notification_messages" */
export type Notification_Messages_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Notification_Messages_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** order by aggregate values of table "notification_messages" */
export type Notification_Messages_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Notification_Messages_Max_Order_By>;
  min?: InputMaybe<Notification_Messages_Min_Order_By>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Notification_Messages_Append_Input = {
  data?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** input type for inserting array relation for remote table "notification_messages" */
export type Notification_Messages_Arr_Rel_Insert_Input = {
  data: Array<Notification_Messages_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Notification_Messages_On_Conflict>;
};

/** Boolean expression to filter rows from the table "notification_messages". All fields are combined with a logical 'AND'. */
export type Notification_Messages_Bool_Exp = {
  _and?: InputMaybe<Array<Notification_Messages_Bool_Exp>>;
  _hasyx_schema_name?: InputMaybe<String_Comparison_Exp>;
  _hasyx_table_name?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Notification_Messages_Bool_Exp>;
  _or?: InputMaybe<Array<Notification_Messages_Bool_Exp>>;
  body?: InputMaybe<String_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  data?: InputMaybe<Jsonb_Comparison_Exp>;
  hasyx?: InputMaybe<Hasyx_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  notifications?: InputMaybe<Notifications_Bool_Exp>;
  notifications_aggregate?: InputMaybe<Notifications_Aggregate_Bool_Exp>;
  title?: InputMaybe<String_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  user_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "notification_messages" */
export enum Notification_Messages_Constraint {
  /** unique or primary key constraint on columns "id" */
  NotificationMessagesPkey = "notification_messages_pkey",
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Notification_Messages_Delete_At_Path_Input = {
  data?: InputMaybe<Array<Scalars["String"]["input"]>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Notification_Messages_Delete_Elem_Input = {
  data?: InputMaybe<Scalars["Int"]["input"]>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Notification_Messages_Delete_Key_Input = {
  data?: InputMaybe<Scalars["String"]["input"]>;
};

/** input type for inserting data into table "notification_messages" */
export type Notification_Messages_Insert_Input = {
  body?: InputMaybe<Scalars["String"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  data?: InputMaybe<Scalars["jsonb"]["input"]>;
  hasyx?: InputMaybe<Hasyx_Obj_Rel_Insert_Input>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  notifications?: InputMaybe<Notifications_Arr_Rel_Insert_Input>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** aggregate max on columns */
export type Notification_Messages_Max_Fields = {
  __typename?: "notification_messages_max_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  body?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  title?: Maybe<Scalars["String"]["output"]>;
  user_id?: Maybe<Scalars["uuid"]["output"]>;
};

/** order by max() on columns of table "notification_messages" */
export type Notification_Messages_Max_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  body?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  title?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Notification_Messages_Min_Fields = {
  __typename?: "notification_messages_min_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  body?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  title?: Maybe<Scalars["String"]["output"]>;
  user_id?: Maybe<Scalars["uuid"]["output"]>;
};

/** order by min() on columns of table "notification_messages" */
export type Notification_Messages_Min_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  body?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  title?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "notification_messages" */
export type Notification_Messages_Mutation_Response = {
  __typename?: "notification_messages_mutation_response";
  /** number of rows affected by the mutation */
  affected_rows: Scalars["Int"]["output"];
  /** data from the rows affected by the mutation */
  returning: Array<Notification_Messages>;
};

/** input type for inserting object relation for remote table "notification_messages" */
export type Notification_Messages_Obj_Rel_Insert_Input = {
  data: Notification_Messages_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Notification_Messages_On_Conflict>;
};

/** on_conflict condition type for table "notification_messages" */
export type Notification_Messages_On_Conflict = {
  constraint: Notification_Messages_Constraint;
  update_columns?: Array<Notification_Messages_Update_Column>;
  where?: InputMaybe<Notification_Messages_Bool_Exp>;
};

/** Ordering options when selecting data from "notification_messages". */
export type Notification_Messages_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  body?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  data?: InputMaybe<Order_By>;
  hasyx?: InputMaybe<Hasyx_Order_By>;
  id?: InputMaybe<Order_By>;
  notifications_aggregate?: InputMaybe<Notifications_Aggregate_Order_By>;
  title?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: notification_messages */
export type Notification_Messages_Pk_Columns_Input = {
  id: Scalars["uuid"]["input"];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Notification_Messages_Prepend_Input = {
  data?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** select columns of table "notification_messages" */
export enum Notification_Messages_Select_Column {
  /** column name */
  HasyxSchemaName = "_hasyx_schema_name",
  /** column name */
  HasyxTableName = "_hasyx_table_name",
  /** column name */
  Body = "body",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  Data = "data",
  /** column name */
  Id = "id",
  /** column name */
  Title = "title",
  /** column name */
  UserId = "user_id",
}

/** input type for updating data in table "notification_messages" */
export type Notification_Messages_Set_Input = {
  body?: InputMaybe<Scalars["String"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  data?: InputMaybe<Scalars["jsonb"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** Streaming cursor of the table "notification_messages" */
export type Notification_Messages_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Notification_Messages_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Notification_Messages_Stream_Cursor_Value_Input = {
  _hasyx_schema_name?: InputMaybe<Scalars["String"]["input"]>;
  _hasyx_table_name?: InputMaybe<Scalars["String"]["input"]>;
  body?: InputMaybe<Scalars["String"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  data?: InputMaybe<Scalars["jsonb"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** update columns of table "notification_messages" */
export enum Notification_Messages_Update_Column {
  /** column name */
  Body = "body",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  Data = "data",
  /** column name */
  Id = "id",
  /** column name */
  Title = "title",
  /** column name */
  UserId = "user_id",
}

export type Notification_Messages_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Notification_Messages_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Notification_Messages_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Notification_Messages_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Notification_Messages_Delete_Key_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Notification_Messages_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Notification_Messages_Set_Input>;
  /** filter the rows which have to be updated */
  where: Notification_Messages_Bool_Exp;
};

/** columns and relationships of "notification_permissions" */
export type Notification_Permissions = {
  __typename?: "notification_permissions";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  created_at: Scalars["timestamptz"]["output"];
  device_info: Scalars["jsonb"]["output"];
  device_token: Scalars["String"]["output"];
  /** An object relationship */
  hasyx?: Maybe<Hasyx>;
  id: Scalars["uuid"]["output"];
  /** An array relationship */
  notifications: Array<Notifications>;
  /** An aggregate relationship */
  notifications_aggregate: Notifications_Aggregate;
  provider: Scalars["String"]["output"];
  updated_at: Scalars["timestamptz"]["output"];
  /** An object relationship */
  user: Users;
  user_id: Scalars["uuid"]["output"];
};

/** columns and relationships of "notification_permissions" */
export type Notification_PermissionsDevice_InfoArgs = {
  path?: InputMaybe<Scalars["String"]["input"]>;
};

/** columns and relationships of "notification_permissions" */
export type Notification_PermissionsNotificationsArgs = {
  distinct_on?: InputMaybe<Array<Notifications_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notifications_Order_By>>;
  where?: InputMaybe<Notifications_Bool_Exp>;
};

/** columns and relationships of "notification_permissions" */
export type Notification_PermissionsNotifications_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Notifications_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notifications_Order_By>>;
  where?: InputMaybe<Notifications_Bool_Exp>;
};

/** aggregated selection of "notification_permissions" */
export type Notification_Permissions_Aggregate = {
  __typename?: "notification_permissions_aggregate";
  aggregate?: Maybe<Notification_Permissions_Aggregate_Fields>;
  nodes: Array<Notification_Permissions>;
};

export type Notification_Permissions_Aggregate_Bool_Exp = {
  count?: InputMaybe<Notification_Permissions_Aggregate_Bool_Exp_Count>;
};

export type Notification_Permissions_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Notification_Permissions_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
  filter?: InputMaybe<Notification_Permissions_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "notification_permissions" */
export type Notification_Permissions_Aggregate_Fields = {
  __typename?: "notification_permissions_aggregate_fields";
  count: Scalars["Int"]["output"];
  max?: Maybe<Notification_Permissions_Max_Fields>;
  min?: Maybe<Notification_Permissions_Min_Fields>;
};

/** aggregate fields of "notification_permissions" */
export type Notification_Permissions_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Notification_Permissions_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** order by aggregate values of table "notification_permissions" */
export type Notification_Permissions_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Notification_Permissions_Max_Order_By>;
  min?: InputMaybe<Notification_Permissions_Min_Order_By>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Notification_Permissions_Append_Input = {
  device_info?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** input type for inserting array relation for remote table "notification_permissions" */
export type Notification_Permissions_Arr_Rel_Insert_Input = {
  data: Array<Notification_Permissions_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Notification_Permissions_On_Conflict>;
};

/** Boolean expression to filter rows from the table "notification_permissions". All fields are combined with a logical 'AND'. */
export type Notification_Permissions_Bool_Exp = {
  _and?: InputMaybe<Array<Notification_Permissions_Bool_Exp>>;
  _hasyx_schema_name?: InputMaybe<String_Comparison_Exp>;
  _hasyx_table_name?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Notification_Permissions_Bool_Exp>;
  _or?: InputMaybe<Array<Notification_Permissions_Bool_Exp>>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  device_info?: InputMaybe<Jsonb_Comparison_Exp>;
  device_token?: InputMaybe<String_Comparison_Exp>;
  hasyx?: InputMaybe<Hasyx_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  notifications?: InputMaybe<Notifications_Bool_Exp>;
  notifications_aggregate?: InputMaybe<Notifications_Aggregate_Bool_Exp>;
  provider?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  user_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "notification_permissions" */
export enum Notification_Permissions_Constraint {
  /** unique or primary key constraint on columns "id" */
  NotificationPermissionsPkey = "notification_permissions_pkey",
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Notification_Permissions_Delete_At_Path_Input = {
  device_info?: InputMaybe<Array<Scalars["String"]["input"]>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Notification_Permissions_Delete_Elem_Input = {
  device_info?: InputMaybe<Scalars["Int"]["input"]>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Notification_Permissions_Delete_Key_Input = {
  device_info?: InputMaybe<Scalars["String"]["input"]>;
};

/** input type for inserting data into table "notification_permissions" */
export type Notification_Permissions_Insert_Input = {
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  device_info?: InputMaybe<Scalars["jsonb"]["input"]>;
  device_token?: InputMaybe<Scalars["String"]["input"]>;
  hasyx?: InputMaybe<Hasyx_Obj_Rel_Insert_Input>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  notifications?: InputMaybe<Notifications_Arr_Rel_Insert_Input>;
  provider?: InputMaybe<Scalars["String"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** aggregate max on columns */
export type Notification_Permissions_Max_Fields = {
  __typename?: "notification_permissions_max_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  device_token?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  provider?: Maybe<Scalars["String"]["output"]>;
  updated_at?: Maybe<Scalars["timestamptz"]["output"]>;
  user_id?: Maybe<Scalars["uuid"]["output"]>;
};

/** order by max() on columns of table "notification_permissions" */
export type Notification_Permissions_Max_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  device_token?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  provider?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Notification_Permissions_Min_Fields = {
  __typename?: "notification_permissions_min_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  device_token?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  provider?: Maybe<Scalars["String"]["output"]>;
  updated_at?: Maybe<Scalars["timestamptz"]["output"]>;
  user_id?: Maybe<Scalars["uuid"]["output"]>;
};

/** order by min() on columns of table "notification_permissions" */
export type Notification_Permissions_Min_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  device_token?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  provider?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "notification_permissions" */
export type Notification_Permissions_Mutation_Response = {
  __typename?: "notification_permissions_mutation_response";
  /** number of rows affected by the mutation */
  affected_rows: Scalars["Int"]["output"];
  /** data from the rows affected by the mutation */
  returning: Array<Notification_Permissions>;
};

/** input type for inserting object relation for remote table "notification_permissions" */
export type Notification_Permissions_Obj_Rel_Insert_Input = {
  data: Notification_Permissions_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Notification_Permissions_On_Conflict>;
};

/** on_conflict condition type for table "notification_permissions" */
export type Notification_Permissions_On_Conflict = {
  constraint: Notification_Permissions_Constraint;
  update_columns?: Array<Notification_Permissions_Update_Column>;
  where?: InputMaybe<Notification_Permissions_Bool_Exp>;
};

/** Ordering options when selecting data from "notification_permissions". */
export type Notification_Permissions_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  device_info?: InputMaybe<Order_By>;
  device_token?: InputMaybe<Order_By>;
  hasyx?: InputMaybe<Hasyx_Order_By>;
  id?: InputMaybe<Order_By>;
  notifications_aggregate?: InputMaybe<Notifications_Aggregate_Order_By>;
  provider?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: notification_permissions */
export type Notification_Permissions_Pk_Columns_Input = {
  id: Scalars["uuid"]["input"];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Notification_Permissions_Prepend_Input = {
  device_info?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** select columns of table "notification_permissions" */
export enum Notification_Permissions_Select_Column {
  /** column name */
  HasyxSchemaName = "_hasyx_schema_name",
  /** column name */
  HasyxTableName = "_hasyx_table_name",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  DeviceInfo = "device_info",
  /** column name */
  DeviceToken = "device_token",
  /** column name */
  Id = "id",
  /** column name */
  Provider = "provider",
  /** column name */
  UpdatedAt = "updated_at",
  /** column name */
  UserId = "user_id",
}

/** input type for updating data in table "notification_permissions" */
export type Notification_Permissions_Set_Input = {
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  device_info?: InputMaybe<Scalars["jsonb"]["input"]>;
  device_token?: InputMaybe<Scalars["String"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  provider?: InputMaybe<Scalars["String"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** Streaming cursor of the table "notification_permissions" */
export type Notification_Permissions_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Notification_Permissions_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Notification_Permissions_Stream_Cursor_Value_Input = {
  _hasyx_schema_name?: InputMaybe<Scalars["String"]["input"]>;
  _hasyx_table_name?: InputMaybe<Scalars["String"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  device_info?: InputMaybe<Scalars["jsonb"]["input"]>;
  device_token?: InputMaybe<Scalars["String"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  provider?: InputMaybe<Scalars["String"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** update columns of table "notification_permissions" */
export enum Notification_Permissions_Update_Column {
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  DeviceInfo = "device_info",
  /** column name */
  DeviceToken = "device_token",
  /** column name */
  Id = "id",
  /** column name */
  Provider = "provider",
  /** column name */
  UpdatedAt = "updated_at",
  /** column name */
  UserId = "user_id",
}

export type Notification_Permissions_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Notification_Permissions_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Notification_Permissions_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Notification_Permissions_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Notification_Permissions_Delete_Key_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Notification_Permissions_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Notification_Permissions_Set_Input>;
  /** filter the rows which have to be updated */
  where: Notification_Permissions_Bool_Exp;
};

/** columns and relationships of "notifications" */
export type Notifications = {
  __typename?: "notifications";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  config?: Maybe<Scalars["jsonb"]["output"]>;
  created_at: Scalars["timestamptz"]["output"];
  error?: Maybe<Scalars["String"]["output"]>;
  /** An object relationship */
  hasyx?: Maybe<Hasyx>;
  id: Scalars["uuid"]["output"];
  /** An object relationship */
  message: Notification_Messages;
  message_id: Scalars["uuid"]["output"];
  /** An object relationship */
  permission: Notification_Permissions;
  permission_id: Scalars["uuid"]["output"];
  status: Scalars["String"]["output"];
  updated_at: Scalars["timestamptz"]["output"];
};

/** columns and relationships of "notifications" */
export type NotificationsConfigArgs = {
  path?: InputMaybe<Scalars["String"]["input"]>;
};

/** aggregated selection of "notifications" */
export type Notifications_Aggregate = {
  __typename?: "notifications_aggregate";
  aggregate?: Maybe<Notifications_Aggregate_Fields>;
  nodes: Array<Notifications>;
};

export type Notifications_Aggregate_Bool_Exp = {
  count?: InputMaybe<Notifications_Aggregate_Bool_Exp_Count>;
};

export type Notifications_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Notifications_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
  filter?: InputMaybe<Notifications_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "notifications" */
export type Notifications_Aggregate_Fields = {
  __typename?: "notifications_aggregate_fields";
  count: Scalars["Int"]["output"];
  max?: Maybe<Notifications_Max_Fields>;
  min?: Maybe<Notifications_Min_Fields>;
};

/** aggregate fields of "notifications" */
export type Notifications_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Notifications_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** order by aggregate values of table "notifications" */
export type Notifications_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Notifications_Max_Order_By>;
  min?: InputMaybe<Notifications_Min_Order_By>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Notifications_Append_Input = {
  config?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** input type for inserting array relation for remote table "notifications" */
export type Notifications_Arr_Rel_Insert_Input = {
  data: Array<Notifications_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Notifications_On_Conflict>;
};

/** Boolean expression to filter rows from the table "notifications". All fields are combined with a logical 'AND'. */
export type Notifications_Bool_Exp = {
  _and?: InputMaybe<Array<Notifications_Bool_Exp>>;
  _hasyx_schema_name?: InputMaybe<String_Comparison_Exp>;
  _hasyx_table_name?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Notifications_Bool_Exp>;
  _or?: InputMaybe<Array<Notifications_Bool_Exp>>;
  config?: InputMaybe<Jsonb_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  error?: InputMaybe<String_Comparison_Exp>;
  hasyx?: InputMaybe<Hasyx_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  message?: InputMaybe<Notification_Messages_Bool_Exp>;
  message_id?: InputMaybe<Uuid_Comparison_Exp>;
  permission?: InputMaybe<Notification_Permissions_Bool_Exp>;
  permission_id?: InputMaybe<Uuid_Comparison_Exp>;
  status?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "notifications" */
export enum Notifications_Constraint {
  /** unique or primary key constraint on columns "id" */
  NotificationsPkey = "notifications_pkey",
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Notifications_Delete_At_Path_Input = {
  config?: InputMaybe<Array<Scalars["String"]["input"]>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Notifications_Delete_Elem_Input = {
  config?: InputMaybe<Scalars["Int"]["input"]>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Notifications_Delete_Key_Input = {
  config?: InputMaybe<Scalars["String"]["input"]>;
};

/** input type for inserting data into table "notifications" */
export type Notifications_Insert_Input = {
  config?: InputMaybe<Scalars["jsonb"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  error?: InputMaybe<Scalars["String"]["input"]>;
  hasyx?: InputMaybe<Hasyx_Obj_Rel_Insert_Input>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  message?: InputMaybe<Notification_Messages_Obj_Rel_Insert_Input>;
  message_id?: InputMaybe<Scalars["uuid"]["input"]>;
  permission?: InputMaybe<Notification_Permissions_Obj_Rel_Insert_Input>;
  permission_id?: InputMaybe<Scalars["uuid"]["input"]>;
  status?: InputMaybe<Scalars["String"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
};

/** aggregate max on columns */
export type Notifications_Max_Fields = {
  __typename?: "notifications_max_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  error?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  message_id?: Maybe<Scalars["uuid"]["output"]>;
  permission_id?: Maybe<Scalars["uuid"]["output"]>;
  status?: Maybe<Scalars["String"]["output"]>;
  updated_at?: Maybe<Scalars["timestamptz"]["output"]>;
};

/** order by max() on columns of table "notifications" */
export type Notifications_Max_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  error?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message_id?: InputMaybe<Order_By>;
  permission_id?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Notifications_Min_Fields = {
  __typename?: "notifications_min_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  error?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  message_id?: Maybe<Scalars["uuid"]["output"]>;
  permission_id?: Maybe<Scalars["uuid"]["output"]>;
  status?: Maybe<Scalars["String"]["output"]>;
  updated_at?: Maybe<Scalars["timestamptz"]["output"]>;
};

/** order by min() on columns of table "notifications" */
export type Notifications_Min_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  error?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message_id?: InputMaybe<Order_By>;
  permission_id?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "notifications" */
export type Notifications_Mutation_Response = {
  __typename?: "notifications_mutation_response";
  /** number of rows affected by the mutation */
  affected_rows: Scalars["Int"]["output"];
  /** data from the rows affected by the mutation */
  returning: Array<Notifications>;
};

/** input type for inserting object relation for remote table "notifications" */
export type Notifications_Obj_Rel_Insert_Input = {
  data: Notifications_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Notifications_On_Conflict>;
};

/** on_conflict condition type for table "notifications" */
export type Notifications_On_Conflict = {
  constraint: Notifications_Constraint;
  update_columns?: Array<Notifications_Update_Column>;
  where?: InputMaybe<Notifications_Bool_Exp>;
};

/** Ordering options when selecting data from "notifications". */
export type Notifications_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  config?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  error?: InputMaybe<Order_By>;
  hasyx?: InputMaybe<Hasyx_Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Notification_Messages_Order_By>;
  message_id?: InputMaybe<Order_By>;
  permission?: InputMaybe<Notification_Permissions_Order_By>;
  permission_id?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: notifications */
export type Notifications_Pk_Columns_Input = {
  id: Scalars["uuid"]["input"];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Notifications_Prepend_Input = {
  config?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** select columns of table "notifications" */
export enum Notifications_Select_Column {
  /** column name */
  HasyxSchemaName = "_hasyx_schema_name",
  /** column name */
  HasyxTableName = "_hasyx_table_name",
  /** column name */
  Config = "config",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  Error = "error",
  /** column name */
  Id = "id",
  /** column name */
  MessageId = "message_id",
  /** column name */
  PermissionId = "permission_id",
  /** column name */
  Status = "status",
  /** column name */
  UpdatedAt = "updated_at",
}

/** input type for updating data in table "notifications" */
export type Notifications_Set_Input = {
  config?: InputMaybe<Scalars["jsonb"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  error?: InputMaybe<Scalars["String"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  message_id?: InputMaybe<Scalars["uuid"]["input"]>;
  permission_id?: InputMaybe<Scalars["uuid"]["input"]>;
  status?: InputMaybe<Scalars["String"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
};

/** Streaming cursor of the table "notifications" */
export type Notifications_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Notifications_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Notifications_Stream_Cursor_Value_Input = {
  _hasyx_schema_name?: InputMaybe<Scalars["String"]["input"]>;
  _hasyx_table_name?: InputMaybe<Scalars["String"]["input"]>;
  config?: InputMaybe<Scalars["jsonb"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  error?: InputMaybe<Scalars["String"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  message_id?: InputMaybe<Scalars["uuid"]["input"]>;
  permission_id?: InputMaybe<Scalars["uuid"]["input"]>;
  status?: InputMaybe<Scalars["String"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
};

/** update columns of table "notifications" */
export enum Notifications_Update_Column {
  /** column name */
  Config = "config",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  Error = "error",
  /** column name */
  Id = "id",
  /** column name */
  MessageId = "message_id",
  /** column name */
  PermissionId = "permission_id",
  /** column name */
  Status = "status",
  /** column name */
  UpdatedAt = "updated_at",
}

export type Notifications_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Notifications_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Notifications_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Notifications_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Notifications_Delete_Key_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Notifications_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Notifications_Set_Input>;
  /** filter the rows which have to be updated */
  where: Notifications_Bool_Exp;
};

/** Boolean expression to compare columns of type "numeric". All fields are combined with logical 'AND'. */
export type Numeric_Comparison_Exp = {
  _eq?: InputMaybe<Scalars["numeric"]["input"]>;
  _gt?: InputMaybe<Scalars["numeric"]["input"]>;
  _gte?: InputMaybe<Scalars["numeric"]["input"]>;
  _in?: InputMaybe<Array<Scalars["numeric"]["input"]>>;
  _is_null?: InputMaybe<Scalars["Boolean"]["input"]>;
  _lt?: InputMaybe<Scalars["numeric"]["input"]>;
  _lte?: InputMaybe<Scalars["numeric"]["input"]>;
  _neq?: InputMaybe<Scalars["numeric"]["input"]>;
  _nin?: InputMaybe<Array<Scalars["numeric"]["input"]>>;
};

/** column ordering options */
export enum Order_By {
  /** in ascending order, nulls last */
  Asc = "asc",
  /** in ascending order, nulls first */
  AscNullsFirst = "asc_nulls_first",
  /** in ascending order, nulls last */
  AscNullsLast = "asc_nulls_last",
  /** in descending order, nulls first */
  Desc = "desc",
  /** in descending order, nulls first */
  DescNullsFirst = "desc_nulls_first",
  /** in descending order, nulls last */
  DescNullsLast = "desc_nulls_last",
}

/** columns and relationships of "payment_methods" */
export type Payment_Methods = {
  __typename?: "payment_methods";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  created_at: Scalars["timestamptz"]["output"];
  /** Partially masked data for display */
  details?: Maybe<Scalars["jsonb"]["output"]>;
  expires_at?: Maybe<Scalars["timestamptz"]["output"]>;
  /** Payment method ID in the external system */
  external_id?: Maybe<Scalars["String"]["output"]>;
  /** An object relationship */
  hasyx?: Maybe<Hasyx>;
  id: Scalars["uuid"]["output"];
  is_default: Scalars["Boolean"]["output"];
  is_recurrent_ready: Scalars["Boolean"]["output"];
  /** An array relationship */
  payments: Array<Payments>;
  /** An aggregate relationship */
  payments_aggregate: Payments_Aggregate;
  /** e.g., "tbank", "linkcom", "ton_api" */
  provider_name: Scalars["String"]["output"];
  /** Provider-specific data for recurrent payments (may require encryption) */
  recurrent_details?: Maybe<Scalars["jsonb"]["output"]>;
  /** e.g., "active", "expired", "revoked" */
  status: Scalars["String"]["output"];
  /** An array relationship */
  subscriptions: Array<Subscriptions>;
  /** An aggregate relationship */
  subscriptions_aggregate: Subscriptions_Aggregate;
  /** e.g., "card", "ton_wallet", "sbp" */
  type: Scalars["String"]["output"];
  updated_at: Scalars["timestamptz"]["output"];
  /** An object relationship */
  user: Users;
  user_id: Scalars["uuid"]["output"];
};

/** columns and relationships of "payment_methods" */
export type Payment_MethodsDetailsArgs = {
  path?: InputMaybe<Scalars["String"]["input"]>;
};

/** columns and relationships of "payment_methods" */
export type Payment_MethodsPaymentsArgs = {
  distinct_on?: InputMaybe<Array<Payments_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payments_Order_By>>;
  where?: InputMaybe<Payments_Bool_Exp>;
};

/** columns and relationships of "payment_methods" */
export type Payment_MethodsPayments_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Payments_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payments_Order_By>>;
  where?: InputMaybe<Payments_Bool_Exp>;
};

/** columns and relationships of "payment_methods" */
export type Payment_MethodsRecurrent_DetailsArgs = {
  path?: InputMaybe<Scalars["String"]["input"]>;
};

/** columns and relationships of "payment_methods" */
export type Payment_MethodsSubscriptionsArgs = {
  distinct_on?: InputMaybe<Array<Subscriptions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscriptions_Order_By>>;
  where?: InputMaybe<Subscriptions_Bool_Exp>;
};

/** columns and relationships of "payment_methods" */
export type Payment_MethodsSubscriptions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Subscriptions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscriptions_Order_By>>;
  where?: InputMaybe<Subscriptions_Bool_Exp>;
};

/** aggregated selection of "payment_methods" */
export type Payment_Methods_Aggregate = {
  __typename?: "payment_methods_aggregate";
  aggregate?: Maybe<Payment_Methods_Aggregate_Fields>;
  nodes: Array<Payment_Methods>;
};

export type Payment_Methods_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Payment_Methods_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Payment_Methods_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Payment_Methods_Aggregate_Bool_Exp_Count>;
};

export type Payment_Methods_Aggregate_Bool_Exp_Bool_And = {
  arguments: Payment_Methods_Select_Column_Payment_Methods_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
  filter?: InputMaybe<Payment_Methods_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Payment_Methods_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Payment_Methods_Select_Column_Payment_Methods_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
  filter?: InputMaybe<Payment_Methods_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Payment_Methods_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Payment_Methods_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
  filter?: InputMaybe<Payment_Methods_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "payment_methods" */
export type Payment_Methods_Aggregate_Fields = {
  __typename?: "payment_methods_aggregate_fields";
  count: Scalars["Int"]["output"];
  max?: Maybe<Payment_Methods_Max_Fields>;
  min?: Maybe<Payment_Methods_Min_Fields>;
};

/** aggregate fields of "payment_methods" */
export type Payment_Methods_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Payment_Methods_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** order by aggregate values of table "payment_methods" */
export type Payment_Methods_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Payment_Methods_Max_Order_By>;
  min?: InputMaybe<Payment_Methods_Min_Order_By>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Payment_Methods_Append_Input = {
  /** Partially masked data for display */
  details?: InputMaybe<Scalars["jsonb"]["input"]>;
  /** Provider-specific data for recurrent payments (may require encryption) */
  recurrent_details?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** input type for inserting array relation for remote table "payment_methods" */
export type Payment_Methods_Arr_Rel_Insert_Input = {
  data: Array<Payment_Methods_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Payment_Methods_On_Conflict>;
};

/** Boolean expression to filter rows from the table "payment_methods". All fields are combined with a logical 'AND'. */
export type Payment_Methods_Bool_Exp = {
  _and?: InputMaybe<Array<Payment_Methods_Bool_Exp>>;
  _hasyx_schema_name?: InputMaybe<String_Comparison_Exp>;
  _hasyx_table_name?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Payment_Methods_Bool_Exp>;
  _or?: InputMaybe<Array<Payment_Methods_Bool_Exp>>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  details?: InputMaybe<Jsonb_Comparison_Exp>;
  expires_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  external_id?: InputMaybe<String_Comparison_Exp>;
  hasyx?: InputMaybe<Hasyx_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  is_default?: InputMaybe<Boolean_Comparison_Exp>;
  is_recurrent_ready?: InputMaybe<Boolean_Comparison_Exp>;
  payments?: InputMaybe<Payments_Bool_Exp>;
  payments_aggregate?: InputMaybe<Payments_Aggregate_Bool_Exp>;
  provider_name?: InputMaybe<String_Comparison_Exp>;
  recurrent_details?: InputMaybe<Jsonb_Comparison_Exp>;
  status?: InputMaybe<String_Comparison_Exp>;
  subscriptions?: InputMaybe<Subscriptions_Bool_Exp>;
  subscriptions_aggregate?: InputMaybe<Subscriptions_Aggregate_Bool_Exp>;
  type?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  user_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "payment_methods" */
export enum Payment_Methods_Constraint {
  /** unique or primary key constraint on columns "id" */
  PaymentMethodsPkey = "payment_methods_pkey",
  /** unique or primary key constraint on columns "user_id", "type", "external_id", "provider_name" */
  PaymentMethodsUserIdProviderNameExternalIdTypeKey = "payment_methods_user_id_provider_name_external_id_type_key",
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Payment_Methods_Delete_At_Path_Input = {
  /** Partially masked data for display */
  details?: InputMaybe<Array<Scalars["String"]["input"]>>;
  /** Provider-specific data for recurrent payments (may require encryption) */
  recurrent_details?: InputMaybe<Array<Scalars["String"]["input"]>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Payment_Methods_Delete_Elem_Input = {
  /** Partially masked data for display */
  details?: InputMaybe<Scalars["Int"]["input"]>;
  /** Provider-specific data for recurrent payments (may require encryption) */
  recurrent_details?: InputMaybe<Scalars["Int"]["input"]>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Payment_Methods_Delete_Key_Input = {
  /** Partially masked data for display */
  details?: InputMaybe<Scalars["String"]["input"]>;
  /** Provider-specific data for recurrent payments (may require encryption) */
  recurrent_details?: InputMaybe<Scalars["String"]["input"]>;
};

/** input type for inserting data into table "payment_methods" */
export type Payment_Methods_Insert_Input = {
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  /** Partially masked data for display */
  details?: InputMaybe<Scalars["jsonb"]["input"]>;
  expires_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  /** Payment method ID in the external system */
  external_id?: InputMaybe<Scalars["String"]["input"]>;
  hasyx?: InputMaybe<Hasyx_Obj_Rel_Insert_Input>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  is_default?: InputMaybe<Scalars["Boolean"]["input"]>;
  is_recurrent_ready?: InputMaybe<Scalars["Boolean"]["input"]>;
  payments?: InputMaybe<Payments_Arr_Rel_Insert_Input>;
  /** e.g., "tbank", "linkcom", "ton_api" */
  provider_name?: InputMaybe<Scalars["String"]["input"]>;
  /** Provider-specific data for recurrent payments (may require encryption) */
  recurrent_details?: InputMaybe<Scalars["jsonb"]["input"]>;
  /** e.g., "active", "expired", "revoked" */
  status?: InputMaybe<Scalars["String"]["input"]>;
  subscriptions?: InputMaybe<Subscriptions_Arr_Rel_Insert_Input>;
  /** e.g., "card", "ton_wallet", "sbp" */
  type?: InputMaybe<Scalars["String"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** aggregate max on columns */
export type Payment_Methods_Max_Fields = {
  __typename?: "payment_methods_max_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  expires_at?: Maybe<Scalars["timestamptz"]["output"]>;
  /** Payment method ID in the external system */
  external_id?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  /** e.g., "tbank", "linkcom", "ton_api" */
  provider_name?: Maybe<Scalars["String"]["output"]>;
  /** e.g., "active", "expired", "revoked" */
  status?: Maybe<Scalars["String"]["output"]>;
  /** e.g., "card", "ton_wallet", "sbp" */
  type?: Maybe<Scalars["String"]["output"]>;
  updated_at?: Maybe<Scalars["timestamptz"]["output"]>;
  user_id?: Maybe<Scalars["uuid"]["output"]>;
};

/** order by max() on columns of table "payment_methods" */
export type Payment_Methods_Max_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  expires_at?: InputMaybe<Order_By>;
  /** Payment method ID in the external system */
  external_id?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** e.g., "tbank", "linkcom", "ton_api" */
  provider_name?: InputMaybe<Order_By>;
  /** e.g., "active", "expired", "revoked" */
  status?: InputMaybe<Order_By>;
  /** e.g., "card", "ton_wallet", "sbp" */
  type?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Payment_Methods_Min_Fields = {
  __typename?: "payment_methods_min_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  expires_at?: Maybe<Scalars["timestamptz"]["output"]>;
  /** Payment method ID in the external system */
  external_id?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  /** e.g., "tbank", "linkcom", "ton_api" */
  provider_name?: Maybe<Scalars["String"]["output"]>;
  /** e.g., "active", "expired", "revoked" */
  status?: Maybe<Scalars["String"]["output"]>;
  /** e.g., "card", "ton_wallet", "sbp" */
  type?: Maybe<Scalars["String"]["output"]>;
  updated_at?: Maybe<Scalars["timestamptz"]["output"]>;
  user_id?: Maybe<Scalars["uuid"]["output"]>;
};

/** order by min() on columns of table "payment_methods" */
export type Payment_Methods_Min_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  expires_at?: InputMaybe<Order_By>;
  /** Payment method ID in the external system */
  external_id?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** e.g., "tbank", "linkcom", "ton_api" */
  provider_name?: InputMaybe<Order_By>;
  /** e.g., "active", "expired", "revoked" */
  status?: InputMaybe<Order_By>;
  /** e.g., "card", "ton_wallet", "sbp" */
  type?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "payment_methods" */
export type Payment_Methods_Mutation_Response = {
  __typename?: "payment_methods_mutation_response";
  /** number of rows affected by the mutation */
  affected_rows: Scalars["Int"]["output"];
  /** data from the rows affected by the mutation */
  returning: Array<Payment_Methods>;
};

/** input type for inserting object relation for remote table "payment_methods" */
export type Payment_Methods_Obj_Rel_Insert_Input = {
  data: Payment_Methods_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Payment_Methods_On_Conflict>;
};

/** on_conflict condition type for table "payment_methods" */
export type Payment_Methods_On_Conflict = {
  constraint: Payment_Methods_Constraint;
  update_columns?: Array<Payment_Methods_Update_Column>;
  where?: InputMaybe<Payment_Methods_Bool_Exp>;
};

/** Ordering options when selecting data from "payment_methods". */
export type Payment_Methods_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  details?: InputMaybe<Order_By>;
  expires_at?: InputMaybe<Order_By>;
  external_id?: InputMaybe<Order_By>;
  hasyx?: InputMaybe<Hasyx_Order_By>;
  id?: InputMaybe<Order_By>;
  is_default?: InputMaybe<Order_By>;
  is_recurrent_ready?: InputMaybe<Order_By>;
  payments_aggregate?: InputMaybe<Payments_Aggregate_Order_By>;
  provider_name?: InputMaybe<Order_By>;
  recurrent_details?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  subscriptions_aggregate?: InputMaybe<Subscriptions_Aggregate_Order_By>;
  type?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: payment_methods */
export type Payment_Methods_Pk_Columns_Input = {
  id: Scalars["uuid"]["input"];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Payment_Methods_Prepend_Input = {
  /** Partially masked data for display */
  details?: InputMaybe<Scalars["jsonb"]["input"]>;
  /** Provider-specific data for recurrent payments (may require encryption) */
  recurrent_details?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** select columns of table "payment_methods" */
export enum Payment_Methods_Select_Column {
  /** column name */
  HasyxSchemaName = "_hasyx_schema_name",
  /** column name */
  HasyxTableName = "_hasyx_table_name",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  Details = "details",
  /** column name */
  ExpiresAt = "expires_at",
  /** column name */
  ExternalId = "external_id",
  /** column name */
  Id = "id",
  /** column name */
  IsDefault = "is_default",
  /** column name */
  IsRecurrentReady = "is_recurrent_ready",
  /** column name */
  ProviderName = "provider_name",
  /** column name */
  RecurrentDetails = "recurrent_details",
  /** column name */
  Status = "status",
  /** column name */
  Type = "type",
  /** column name */
  UpdatedAt = "updated_at",
  /** column name */
  UserId = "user_id",
}

/** select "payment_methods_aggregate_bool_exp_bool_and_arguments_columns" columns of table "payment_methods" */
export enum Payment_Methods_Select_Column_Payment_Methods_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  IsDefault = "is_default",
  /** column name */
  IsRecurrentReady = "is_recurrent_ready",
}

/** select "payment_methods_aggregate_bool_exp_bool_or_arguments_columns" columns of table "payment_methods" */
export enum Payment_Methods_Select_Column_Payment_Methods_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  IsDefault = "is_default",
  /** column name */
  IsRecurrentReady = "is_recurrent_ready",
}

/** input type for updating data in table "payment_methods" */
export type Payment_Methods_Set_Input = {
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  /** Partially masked data for display */
  details?: InputMaybe<Scalars["jsonb"]["input"]>;
  expires_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  /** Payment method ID in the external system */
  external_id?: InputMaybe<Scalars["String"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  is_default?: InputMaybe<Scalars["Boolean"]["input"]>;
  is_recurrent_ready?: InputMaybe<Scalars["Boolean"]["input"]>;
  /** e.g., "tbank", "linkcom", "ton_api" */
  provider_name?: InputMaybe<Scalars["String"]["input"]>;
  /** Provider-specific data for recurrent payments (may require encryption) */
  recurrent_details?: InputMaybe<Scalars["jsonb"]["input"]>;
  /** e.g., "active", "expired", "revoked" */
  status?: InputMaybe<Scalars["String"]["input"]>;
  /** e.g., "card", "ton_wallet", "sbp" */
  type?: InputMaybe<Scalars["String"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** Streaming cursor of the table "payment_methods" */
export type Payment_Methods_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Payment_Methods_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Payment_Methods_Stream_Cursor_Value_Input = {
  _hasyx_schema_name?: InputMaybe<Scalars["String"]["input"]>;
  _hasyx_table_name?: InputMaybe<Scalars["String"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  /** Partially masked data for display */
  details?: InputMaybe<Scalars["jsonb"]["input"]>;
  expires_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  /** Payment method ID in the external system */
  external_id?: InputMaybe<Scalars["String"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  is_default?: InputMaybe<Scalars["Boolean"]["input"]>;
  is_recurrent_ready?: InputMaybe<Scalars["Boolean"]["input"]>;
  /** e.g., "tbank", "linkcom", "ton_api" */
  provider_name?: InputMaybe<Scalars["String"]["input"]>;
  /** Provider-specific data for recurrent payments (may require encryption) */
  recurrent_details?: InputMaybe<Scalars["jsonb"]["input"]>;
  /** e.g., "active", "expired", "revoked" */
  status?: InputMaybe<Scalars["String"]["input"]>;
  /** e.g., "card", "ton_wallet", "sbp" */
  type?: InputMaybe<Scalars["String"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** update columns of table "payment_methods" */
export enum Payment_Methods_Update_Column {
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  Details = "details",
  /** column name */
  ExpiresAt = "expires_at",
  /** column name */
  ExternalId = "external_id",
  /** column name */
  Id = "id",
  /** column name */
  IsDefault = "is_default",
  /** column name */
  IsRecurrentReady = "is_recurrent_ready",
  /** column name */
  ProviderName = "provider_name",
  /** column name */
  RecurrentDetails = "recurrent_details",
  /** column name */
  Status = "status",
  /** column name */
  Type = "type",
  /** column name */
  UpdatedAt = "updated_at",
  /** column name */
  UserId = "user_id",
}

export type Payment_Methods_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Payment_Methods_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Payment_Methods_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Payment_Methods_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Payment_Methods_Delete_Key_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Payment_Methods_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Payment_Methods_Set_Input>;
  /** filter the rows which have to be updated */
  where: Payment_Methods_Bool_Exp;
};

/** columns and relationships of "payments" */
export type Payments = {
  __typename?: "payments";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  amount: Scalars["numeric"]["output"];
  created_at: Scalars["timestamptz"]["output"];
  currency: Scalars["String"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  error_message?: Maybe<Scalars["String"]["output"]>;
  /** Payment ID in the external system, may not be available immediately */
  external_payment_id?: Maybe<Scalars["String"]["output"]>;
  /** An object relationship */
  hasyx?: Maybe<Hasyx>;
  id: Scalars["uuid"]["output"];
  initiated_at?: Maybe<Scalars["timestamptz"]["output"]>;
  metadata?: Maybe<Scalars["jsonb"]["output"]>;
  object_hid?: Maybe<Scalars["String"]["output"]>;
  paid_at?: Maybe<Scalars["timestamptz"]["output"]>;
  /** An object relationship */
  payment_method?: Maybe<Payment_Methods>;
  payment_method_id?: Maybe<Scalars["uuid"]["output"]>;
  provider_name: Scalars["String"]["output"];
  provider_request_details?: Maybe<Scalars["jsonb"]["output"]>;
  provider_response_details?: Maybe<Scalars["jsonb"]["output"]>;
  /** e.g., "pending_initiation", "pending_confirmation", "succeeded", "failed", "canceled", "refunded" */
  status: Scalars["String"]["output"];
  /** An object relationship */
  subscription?: Maybe<Subscriptions>;
  subscription_id?: Maybe<Scalars["uuid"]["output"]>;
  updated_at: Scalars["timestamptz"]["output"];
  /** An object relationship */
  user: Users;
  user_id: Scalars["uuid"]["output"];
};

/** columns and relationships of "payments" */
export type PaymentsMetadataArgs = {
  path?: InputMaybe<Scalars["String"]["input"]>;
};

/** columns and relationships of "payments" */
export type PaymentsProvider_Request_DetailsArgs = {
  path?: InputMaybe<Scalars["String"]["input"]>;
};

/** columns and relationships of "payments" */
export type PaymentsProvider_Response_DetailsArgs = {
  path?: InputMaybe<Scalars["String"]["input"]>;
};

/** aggregated selection of "payments" */
export type Payments_Aggregate = {
  __typename?: "payments_aggregate";
  aggregate?: Maybe<Payments_Aggregate_Fields>;
  nodes: Array<Payments>;
};

export type Payments_Aggregate_Bool_Exp = {
  count?: InputMaybe<Payments_Aggregate_Bool_Exp_Count>;
};

export type Payments_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Payments_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
  filter?: InputMaybe<Payments_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "payments" */
export type Payments_Aggregate_Fields = {
  __typename?: "payments_aggregate_fields";
  avg?: Maybe<Payments_Avg_Fields>;
  count: Scalars["Int"]["output"];
  max?: Maybe<Payments_Max_Fields>;
  min?: Maybe<Payments_Min_Fields>;
  stddev?: Maybe<Payments_Stddev_Fields>;
  stddev_pop?: Maybe<Payments_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Payments_Stddev_Samp_Fields>;
  sum?: Maybe<Payments_Sum_Fields>;
  var_pop?: Maybe<Payments_Var_Pop_Fields>;
  var_samp?: Maybe<Payments_Var_Samp_Fields>;
  variance?: Maybe<Payments_Variance_Fields>;
};

/** aggregate fields of "payments" */
export type Payments_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Payments_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** order by aggregate values of table "payments" */
export type Payments_Aggregate_Order_By = {
  avg?: InputMaybe<Payments_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Payments_Max_Order_By>;
  min?: InputMaybe<Payments_Min_Order_By>;
  stddev?: InputMaybe<Payments_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Payments_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Payments_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Payments_Sum_Order_By>;
  var_pop?: InputMaybe<Payments_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Payments_Var_Samp_Order_By>;
  variance?: InputMaybe<Payments_Variance_Order_By>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Payments_Append_Input = {
  metadata?: InputMaybe<Scalars["jsonb"]["input"]>;
  provider_request_details?: InputMaybe<Scalars["jsonb"]["input"]>;
  provider_response_details?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** input type for inserting array relation for remote table "payments" */
export type Payments_Arr_Rel_Insert_Input = {
  data: Array<Payments_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Payments_On_Conflict>;
};

/** aggregate avg on columns */
export type Payments_Avg_Fields = {
  __typename?: "payments_avg_fields";
  amount?: Maybe<Scalars["Float"]["output"]>;
};

/** order by avg() on columns of table "payments" */
export type Payments_Avg_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "payments". All fields are combined with a logical 'AND'. */
export type Payments_Bool_Exp = {
  _and?: InputMaybe<Array<Payments_Bool_Exp>>;
  _hasyx_schema_name?: InputMaybe<String_Comparison_Exp>;
  _hasyx_table_name?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Payments_Bool_Exp>;
  _or?: InputMaybe<Array<Payments_Bool_Exp>>;
  amount?: InputMaybe<Numeric_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  currency?: InputMaybe<String_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  error_message?: InputMaybe<String_Comparison_Exp>;
  external_payment_id?: InputMaybe<String_Comparison_Exp>;
  hasyx?: InputMaybe<Hasyx_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  initiated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  metadata?: InputMaybe<Jsonb_Comparison_Exp>;
  object_hid?: InputMaybe<String_Comparison_Exp>;
  paid_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  payment_method?: InputMaybe<Payment_Methods_Bool_Exp>;
  payment_method_id?: InputMaybe<Uuid_Comparison_Exp>;
  provider_name?: InputMaybe<String_Comparison_Exp>;
  provider_request_details?: InputMaybe<Jsonb_Comparison_Exp>;
  provider_response_details?: InputMaybe<Jsonb_Comparison_Exp>;
  status?: InputMaybe<String_Comparison_Exp>;
  subscription?: InputMaybe<Subscriptions_Bool_Exp>;
  subscription_id?: InputMaybe<Uuid_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  user_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "payments" */
export enum Payments_Constraint {
  /** unique or primary key constraint on columns "id" */
  PaymentsPkey = "payments_pkey",
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Payments_Delete_At_Path_Input = {
  metadata?: InputMaybe<Array<Scalars["String"]["input"]>>;
  provider_request_details?: InputMaybe<Array<Scalars["String"]["input"]>>;
  provider_response_details?: InputMaybe<Array<Scalars["String"]["input"]>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Payments_Delete_Elem_Input = {
  metadata?: InputMaybe<Scalars["Int"]["input"]>;
  provider_request_details?: InputMaybe<Scalars["Int"]["input"]>;
  provider_response_details?: InputMaybe<Scalars["Int"]["input"]>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Payments_Delete_Key_Input = {
  metadata?: InputMaybe<Scalars["String"]["input"]>;
  provider_request_details?: InputMaybe<Scalars["String"]["input"]>;
  provider_response_details?: InputMaybe<Scalars["String"]["input"]>;
};

/** input type for incrementing numeric columns in table "payments" */
export type Payments_Inc_Input = {
  amount?: InputMaybe<Scalars["numeric"]["input"]>;
};

/** input type for inserting data into table "payments" */
export type Payments_Insert_Input = {
  amount?: InputMaybe<Scalars["numeric"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  description?: InputMaybe<Scalars["String"]["input"]>;
  error_message?: InputMaybe<Scalars["String"]["input"]>;
  /** Payment ID in the external system, may not be available immediately */
  external_payment_id?: InputMaybe<Scalars["String"]["input"]>;
  hasyx?: InputMaybe<Hasyx_Obj_Rel_Insert_Input>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  initiated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  metadata?: InputMaybe<Scalars["jsonb"]["input"]>;
  object_hid?: InputMaybe<Scalars["String"]["input"]>;
  paid_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  payment_method?: InputMaybe<Payment_Methods_Obj_Rel_Insert_Input>;
  payment_method_id?: InputMaybe<Scalars["uuid"]["input"]>;
  provider_name?: InputMaybe<Scalars["String"]["input"]>;
  provider_request_details?: InputMaybe<Scalars["jsonb"]["input"]>;
  provider_response_details?: InputMaybe<Scalars["jsonb"]["input"]>;
  /** e.g., "pending_initiation", "pending_confirmation", "succeeded", "failed", "canceled", "refunded" */
  status?: InputMaybe<Scalars["String"]["input"]>;
  subscription?: InputMaybe<Subscriptions_Obj_Rel_Insert_Input>;
  subscription_id?: InputMaybe<Scalars["uuid"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** aggregate max on columns */
export type Payments_Max_Fields = {
  __typename?: "payments_max_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  amount?: Maybe<Scalars["numeric"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  currency?: Maybe<Scalars["String"]["output"]>;
  description?: Maybe<Scalars["String"]["output"]>;
  error_message?: Maybe<Scalars["String"]["output"]>;
  /** Payment ID in the external system, may not be available immediately */
  external_payment_id?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  initiated_at?: Maybe<Scalars["timestamptz"]["output"]>;
  object_hid?: Maybe<Scalars["String"]["output"]>;
  paid_at?: Maybe<Scalars["timestamptz"]["output"]>;
  payment_method_id?: Maybe<Scalars["uuid"]["output"]>;
  provider_name?: Maybe<Scalars["String"]["output"]>;
  /** e.g., "pending_initiation", "pending_confirmation", "succeeded", "failed", "canceled", "refunded" */
  status?: Maybe<Scalars["String"]["output"]>;
  subscription_id?: Maybe<Scalars["uuid"]["output"]>;
  updated_at?: Maybe<Scalars["timestamptz"]["output"]>;
  user_id?: Maybe<Scalars["uuid"]["output"]>;
};

/** order by max() on columns of table "payments" */
export type Payments_Max_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  amount?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  error_message?: InputMaybe<Order_By>;
  /** Payment ID in the external system, may not be available immediately */
  external_payment_id?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  initiated_at?: InputMaybe<Order_By>;
  object_hid?: InputMaybe<Order_By>;
  paid_at?: InputMaybe<Order_By>;
  payment_method_id?: InputMaybe<Order_By>;
  provider_name?: InputMaybe<Order_By>;
  /** e.g., "pending_initiation", "pending_confirmation", "succeeded", "failed", "canceled", "refunded" */
  status?: InputMaybe<Order_By>;
  subscription_id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Payments_Min_Fields = {
  __typename?: "payments_min_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  amount?: Maybe<Scalars["numeric"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  currency?: Maybe<Scalars["String"]["output"]>;
  description?: Maybe<Scalars["String"]["output"]>;
  error_message?: Maybe<Scalars["String"]["output"]>;
  /** Payment ID in the external system, may not be available immediately */
  external_payment_id?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  initiated_at?: Maybe<Scalars["timestamptz"]["output"]>;
  object_hid?: Maybe<Scalars["String"]["output"]>;
  paid_at?: Maybe<Scalars["timestamptz"]["output"]>;
  payment_method_id?: Maybe<Scalars["uuid"]["output"]>;
  provider_name?: Maybe<Scalars["String"]["output"]>;
  /** e.g., "pending_initiation", "pending_confirmation", "succeeded", "failed", "canceled", "refunded" */
  status?: Maybe<Scalars["String"]["output"]>;
  subscription_id?: Maybe<Scalars["uuid"]["output"]>;
  updated_at?: Maybe<Scalars["timestamptz"]["output"]>;
  user_id?: Maybe<Scalars["uuid"]["output"]>;
};

/** order by min() on columns of table "payments" */
export type Payments_Min_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  amount?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  error_message?: InputMaybe<Order_By>;
  /** Payment ID in the external system, may not be available immediately */
  external_payment_id?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  initiated_at?: InputMaybe<Order_By>;
  object_hid?: InputMaybe<Order_By>;
  paid_at?: InputMaybe<Order_By>;
  payment_method_id?: InputMaybe<Order_By>;
  provider_name?: InputMaybe<Order_By>;
  /** e.g., "pending_initiation", "pending_confirmation", "succeeded", "failed", "canceled", "refunded" */
  status?: InputMaybe<Order_By>;
  subscription_id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "payments" */
export type Payments_Mutation_Response = {
  __typename?: "payments_mutation_response";
  /** number of rows affected by the mutation */
  affected_rows: Scalars["Int"]["output"];
  /** data from the rows affected by the mutation */
  returning: Array<Payments>;
};

/** input type for inserting object relation for remote table "payments" */
export type Payments_Obj_Rel_Insert_Input = {
  data: Payments_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Payments_On_Conflict>;
};

/** on_conflict condition type for table "payments" */
export type Payments_On_Conflict = {
  constraint: Payments_Constraint;
  update_columns?: Array<Payments_Update_Column>;
  where?: InputMaybe<Payments_Bool_Exp>;
};

/** Ordering options when selecting data from "payments". */
export type Payments_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  amount?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  error_message?: InputMaybe<Order_By>;
  external_payment_id?: InputMaybe<Order_By>;
  hasyx?: InputMaybe<Hasyx_Order_By>;
  id?: InputMaybe<Order_By>;
  initiated_at?: InputMaybe<Order_By>;
  metadata?: InputMaybe<Order_By>;
  object_hid?: InputMaybe<Order_By>;
  paid_at?: InputMaybe<Order_By>;
  payment_method?: InputMaybe<Payment_Methods_Order_By>;
  payment_method_id?: InputMaybe<Order_By>;
  provider_name?: InputMaybe<Order_By>;
  provider_request_details?: InputMaybe<Order_By>;
  provider_response_details?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  subscription?: InputMaybe<Subscriptions_Order_By>;
  subscription_id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: payments */
export type Payments_Pk_Columns_Input = {
  id: Scalars["uuid"]["input"];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Payments_Prepend_Input = {
  metadata?: InputMaybe<Scalars["jsonb"]["input"]>;
  provider_request_details?: InputMaybe<Scalars["jsonb"]["input"]>;
  provider_response_details?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** select columns of table "payments" */
export enum Payments_Select_Column {
  /** column name */
  HasyxSchemaName = "_hasyx_schema_name",
  /** column name */
  HasyxTableName = "_hasyx_table_name",
  /** column name */
  Amount = "amount",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  Currency = "currency",
  /** column name */
  Description = "description",
  /** column name */
  ErrorMessage = "error_message",
  /** column name */
  ExternalPaymentId = "external_payment_id",
  /** column name */
  Id = "id",
  /** column name */
  InitiatedAt = "initiated_at",
  /** column name */
  Metadata = "metadata",
  /** column name */
  ObjectHid = "object_hid",
  /** column name */
  PaidAt = "paid_at",
  /** column name */
  PaymentMethodId = "payment_method_id",
  /** column name */
  ProviderName = "provider_name",
  /** column name */
  ProviderRequestDetails = "provider_request_details",
  /** column name */
  ProviderResponseDetails = "provider_response_details",
  /** column name */
  Status = "status",
  /** column name */
  SubscriptionId = "subscription_id",
  /** column name */
  UpdatedAt = "updated_at",
  /** column name */
  UserId = "user_id",
}

/** input type for updating data in table "payments" */
export type Payments_Set_Input = {
  amount?: InputMaybe<Scalars["numeric"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  description?: InputMaybe<Scalars["String"]["input"]>;
  error_message?: InputMaybe<Scalars["String"]["input"]>;
  /** Payment ID in the external system, may not be available immediately */
  external_payment_id?: InputMaybe<Scalars["String"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  initiated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  metadata?: InputMaybe<Scalars["jsonb"]["input"]>;
  object_hid?: InputMaybe<Scalars["String"]["input"]>;
  paid_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  payment_method_id?: InputMaybe<Scalars["uuid"]["input"]>;
  provider_name?: InputMaybe<Scalars["String"]["input"]>;
  provider_request_details?: InputMaybe<Scalars["jsonb"]["input"]>;
  provider_response_details?: InputMaybe<Scalars["jsonb"]["input"]>;
  /** e.g., "pending_initiation", "pending_confirmation", "succeeded", "failed", "canceled", "refunded" */
  status?: InputMaybe<Scalars["String"]["input"]>;
  subscription_id?: InputMaybe<Scalars["uuid"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** aggregate stddev on columns */
export type Payments_Stddev_Fields = {
  __typename?: "payments_stddev_fields";
  amount?: Maybe<Scalars["Float"]["output"]>;
};

/** order by stddev() on columns of table "payments" */
export type Payments_Stddev_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Payments_Stddev_Pop_Fields = {
  __typename?: "payments_stddev_pop_fields";
  amount?: Maybe<Scalars["Float"]["output"]>;
};

/** order by stddev_pop() on columns of table "payments" */
export type Payments_Stddev_Pop_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Payments_Stddev_Samp_Fields = {
  __typename?: "payments_stddev_samp_fields";
  amount?: Maybe<Scalars["Float"]["output"]>;
};

/** order by stddev_samp() on columns of table "payments" */
export type Payments_Stddev_Samp_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "payments" */
export type Payments_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Payments_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Payments_Stream_Cursor_Value_Input = {
  _hasyx_schema_name?: InputMaybe<Scalars["String"]["input"]>;
  _hasyx_table_name?: InputMaybe<Scalars["String"]["input"]>;
  amount?: InputMaybe<Scalars["numeric"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  description?: InputMaybe<Scalars["String"]["input"]>;
  error_message?: InputMaybe<Scalars["String"]["input"]>;
  /** Payment ID in the external system, may not be available immediately */
  external_payment_id?: InputMaybe<Scalars["String"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  initiated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  metadata?: InputMaybe<Scalars["jsonb"]["input"]>;
  object_hid?: InputMaybe<Scalars["String"]["input"]>;
  paid_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  payment_method_id?: InputMaybe<Scalars["uuid"]["input"]>;
  provider_name?: InputMaybe<Scalars["String"]["input"]>;
  provider_request_details?: InputMaybe<Scalars["jsonb"]["input"]>;
  provider_response_details?: InputMaybe<Scalars["jsonb"]["input"]>;
  /** e.g., "pending_initiation", "pending_confirmation", "succeeded", "failed", "canceled", "refunded" */
  status?: InputMaybe<Scalars["String"]["input"]>;
  subscription_id?: InputMaybe<Scalars["uuid"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** aggregate sum on columns */
export type Payments_Sum_Fields = {
  __typename?: "payments_sum_fields";
  amount?: Maybe<Scalars["numeric"]["output"]>;
};

/** order by sum() on columns of table "payments" */
export type Payments_Sum_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** update columns of table "payments" */
export enum Payments_Update_Column {
  /** column name */
  Amount = "amount",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  Currency = "currency",
  /** column name */
  Description = "description",
  /** column name */
  ErrorMessage = "error_message",
  /** column name */
  ExternalPaymentId = "external_payment_id",
  /** column name */
  Id = "id",
  /** column name */
  InitiatedAt = "initiated_at",
  /** column name */
  Metadata = "metadata",
  /** column name */
  ObjectHid = "object_hid",
  /** column name */
  PaidAt = "paid_at",
  /** column name */
  PaymentMethodId = "payment_method_id",
  /** column name */
  ProviderName = "provider_name",
  /** column name */
  ProviderRequestDetails = "provider_request_details",
  /** column name */
  ProviderResponseDetails = "provider_response_details",
  /** column name */
  Status = "status",
  /** column name */
  SubscriptionId = "subscription_id",
  /** column name */
  UpdatedAt = "updated_at",
  /** column name */
  UserId = "user_id",
}

export type Payments_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Payments_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Payments_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Payments_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Payments_Delete_Key_Input>;
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Payments_Inc_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Payments_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Payments_Set_Input>;
  /** filter the rows which have to be updated */
  where: Payments_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Payments_Var_Pop_Fields = {
  __typename?: "payments_var_pop_fields";
  amount?: Maybe<Scalars["Float"]["output"]>;
};

/** order by var_pop() on columns of table "payments" */
export type Payments_Var_Pop_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Payments_Var_Samp_Fields = {
  __typename?: "payments_var_samp_fields";
  amount?: Maybe<Scalars["Float"]["output"]>;
};

/** order by var_samp() on columns of table "payments" */
export type Payments_Var_Samp_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Payments_Variance_Fields = {
  __typename?: "payments_variance_fields";
  amount?: Maybe<Scalars["Float"]["output"]>;
};

/** order by variance() on columns of table "payments" */
export type Payments_Variance_Order_By = {
  amount?: InputMaybe<Order_By>;
};

export type Query_Root = {
  __typename?: "query_root";
  /** An array relationship */
  accounts: Array<Accounts>;
  /** An aggregate relationship */
  accounts_aggregate: Accounts_Aggregate;
  /** fetch data from the table: "accounts" using primary key columns */
  accounts_by_pk?: Maybe<Accounts>;
  /** fetch data from the table: "debug" */
  debug: Array<Debug>;
  /** fetch aggregated fields from the table: "debug" */
  debug_aggregate: Debug_Aggregate;
  /** fetch data from the table: "debug" using primary key columns */
  debug_by_pk?: Maybe<Debug>;
  /** fetch data from the table: "hasyx" */
  hasyx: Array<Hasyx>;
  /** fetch aggregated fields from the table: "hasyx" */
  hasyx_aggregate: Hasyx_Aggregate;
  /** An array relationship */
  notification_messages: Array<Notification_Messages>;
  /** An aggregate relationship */
  notification_messages_aggregate: Notification_Messages_Aggregate;
  /** fetch data from the table: "notification_messages" using primary key columns */
  notification_messages_by_pk?: Maybe<Notification_Messages>;
  /** An array relationship */
  notification_permissions: Array<Notification_Permissions>;
  /** An aggregate relationship */
  notification_permissions_aggregate: Notification_Permissions_Aggregate;
  /** fetch data from the table: "notification_permissions" using primary key columns */
  notification_permissions_by_pk?: Maybe<Notification_Permissions>;
  /** An array relationship */
  notifications: Array<Notifications>;
  /** An aggregate relationship */
  notifications_aggregate: Notifications_Aggregate;
  /** fetch data from the table: "notifications" using primary key columns */
  notifications_by_pk?: Maybe<Notifications>;
  /** An array relationship */
  payment_methods: Array<Payment_Methods>;
  /** An aggregate relationship */
  payment_methods_aggregate: Payment_Methods_Aggregate;
  /** fetch data from the table: "payment_methods" using primary key columns */
  payment_methods_by_pk?: Maybe<Payment_Methods>;
  /** An array relationship */
  payments: Array<Payments>;
  /** An aggregate relationship */
  payments_aggregate: Payments_Aggregate;
  /** fetch data from the table: "payments" using primary key columns */
  payments_by_pk?: Maybe<Payments>;
  /** fetch data from the table: "subscription_plans" */
  subscription_plans: Array<Subscription_Plans>;
  /** fetch aggregated fields from the table: "subscription_plans" */
  subscription_plans_aggregate: Subscription_Plans_Aggregate;
  /** fetch data from the table: "subscription_plans" using primary key columns */
  subscription_plans_by_pk?: Maybe<Subscription_Plans>;
  /** An array relationship */
  subscriptions: Array<Subscriptions>;
  /** An aggregate relationship */
  subscriptions_aggregate: Subscriptions_Aggregate;
  /** fetch data from the table: "subscriptions" using primary key columns */
  subscriptions_by_pk?: Maybe<Subscriptions>;
  /** fetch data from the table: "users" */
  users: Array<Users>;
  /** fetch aggregated fields from the table: "users" */
  users_aggregate: Users_Aggregate;
  /** fetch data from the table: "users" using primary key columns */
  users_by_pk?: Maybe<Users>;
};

export type Query_RootAccountsArgs = {
  distinct_on?: InputMaybe<Array<Accounts_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Accounts_Order_By>>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};

export type Query_RootAccounts_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Accounts_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Accounts_Order_By>>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};

export type Query_RootAccounts_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Query_RootDebugArgs = {
  distinct_on?: InputMaybe<Array<Debug_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Debug_Order_By>>;
  where?: InputMaybe<Debug_Bool_Exp>;
};

export type Query_RootDebug_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Debug_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Debug_Order_By>>;
  where?: InputMaybe<Debug_Bool_Exp>;
};

export type Query_RootDebug_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Query_RootHasyxArgs = {
  distinct_on?: InputMaybe<Array<Hasyx_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Hasyx_Order_By>>;
  where?: InputMaybe<Hasyx_Bool_Exp>;
};

export type Query_RootHasyx_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Hasyx_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Hasyx_Order_By>>;
  where?: InputMaybe<Hasyx_Bool_Exp>;
};

export type Query_RootNotification_MessagesArgs = {
  distinct_on?: InputMaybe<Array<Notification_Messages_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notification_Messages_Order_By>>;
  where?: InputMaybe<Notification_Messages_Bool_Exp>;
};

export type Query_RootNotification_Messages_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Notification_Messages_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notification_Messages_Order_By>>;
  where?: InputMaybe<Notification_Messages_Bool_Exp>;
};

export type Query_RootNotification_Messages_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Query_RootNotification_PermissionsArgs = {
  distinct_on?: InputMaybe<Array<Notification_Permissions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notification_Permissions_Order_By>>;
  where?: InputMaybe<Notification_Permissions_Bool_Exp>;
};

export type Query_RootNotification_Permissions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Notification_Permissions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notification_Permissions_Order_By>>;
  where?: InputMaybe<Notification_Permissions_Bool_Exp>;
};

export type Query_RootNotification_Permissions_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Query_RootNotificationsArgs = {
  distinct_on?: InputMaybe<Array<Notifications_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notifications_Order_By>>;
  where?: InputMaybe<Notifications_Bool_Exp>;
};

export type Query_RootNotifications_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Notifications_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notifications_Order_By>>;
  where?: InputMaybe<Notifications_Bool_Exp>;
};

export type Query_RootNotifications_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Query_RootPayment_MethodsArgs = {
  distinct_on?: InputMaybe<Array<Payment_Methods_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payment_Methods_Order_By>>;
  where?: InputMaybe<Payment_Methods_Bool_Exp>;
};

export type Query_RootPayment_Methods_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Payment_Methods_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payment_Methods_Order_By>>;
  where?: InputMaybe<Payment_Methods_Bool_Exp>;
};

export type Query_RootPayment_Methods_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Query_RootPaymentsArgs = {
  distinct_on?: InputMaybe<Array<Payments_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payments_Order_By>>;
  where?: InputMaybe<Payments_Bool_Exp>;
};

export type Query_RootPayments_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Payments_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payments_Order_By>>;
  where?: InputMaybe<Payments_Bool_Exp>;
};

export type Query_RootPayments_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Query_RootSubscription_PlansArgs = {
  distinct_on?: InputMaybe<Array<Subscription_Plans_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscription_Plans_Order_By>>;
  where?: InputMaybe<Subscription_Plans_Bool_Exp>;
};

export type Query_RootSubscription_Plans_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Subscription_Plans_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscription_Plans_Order_By>>;
  where?: InputMaybe<Subscription_Plans_Bool_Exp>;
};

export type Query_RootSubscription_Plans_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Query_RootSubscriptionsArgs = {
  distinct_on?: InputMaybe<Array<Subscriptions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscriptions_Order_By>>;
  where?: InputMaybe<Subscriptions_Bool_Exp>;
};

export type Query_RootSubscriptions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Subscriptions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscriptions_Order_By>>;
  where?: InputMaybe<Subscriptions_Bool_Exp>;
};

export type Query_RootSubscriptions_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Query_RootUsersArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};

export type Query_RootUsers_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};

export type Query_RootUsers_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

/** columns and relationships of "subscription_plans" */
export type Subscription_Plans = {
  __typename?: "subscription_plans";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  /** Whether this plan can be subscribed to currently */
  active: Scalars["Boolean"]["output"];
  created_at: Scalars["timestamptz"]["output"];
  currency: Scalars["String"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  features?: Maybe<Scalars["jsonb"]["output"]>;
  /** An object relationship */
  hasyx?: Maybe<Hasyx>;
  id: Scalars["uuid"]["output"];
  /** e.g., "day", "week", "month", "year" */
  interval: Scalars["String"]["output"];
  interval_count: Scalars["Int"]["output"];
  metadata?: Maybe<Scalars["jsonb"]["output"]>;
  name: Scalars["String"]["output"];
  price: Scalars["numeric"]["output"];
  /** An array relationship */
  subscriptions: Array<Subscriptions>;
  /** An aggregate relationship */
  subscriptions_aggregate: Subscriptions_Aggregate;
  trial_period_days: Scalars["Int"]["output"];
  updated_at: Scalars["timestamptz"]["output"];
  /** An object relationship */
  user?: Maybe<Users>;
  /** If NULL, the plan is publicly available. Otherwise, it is custom for the user. */
  user_id?: Maybe<Scalars["uuid"]["output"]>;
};

/** columns and relationships of "subscription_plans" */
export type Subscription_PlansFeaturesArgs = {
  path?: InputMaybe<Scalars["String"]["input"]>;
};

/** columns and relationships of "subscription_plans" */
export type Subscription_PlansMetadataArgs = {
  path?: InputMaybe<Scalars["String"]["input"]>;
};

/** columns and relationships of "subscription_plans" */
export type Subscription_PlansSubscriptionsArgs = {
  distinct_on?: InputMaybe<Array<Subscriptions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscriptions_Order_By>>;
  where?: InputMaybe<Subscriptions_Bool_Exp>;
};

/** columns and relationships of "subscription_plans" */
export type Subscription_PlansSubscriptions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Subscriptions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscriptions_Order_By>>;
  where?: InputMaybe<Subscriptions_Bool_Exp>;
};

/** aggregated selection of "subscription_plans" */
export type Subscription_Plans_Aggregate = {
  __typename?: "subscription_plans_aggregate";
  aggregate?: Maybe<Subscription_Plans_Aggregate_Fields>;
  nodes: Array<Subscription_Plans>;
};

export type Subscription_Plans_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Subscription_Plans_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Subscription_Plans_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Subscription_Plans_Aggregate_Bool_Exp_Count>;
};

export type Subscription_Plans_Aggregate_Bool_Exp_Bool_And = {
  arguments: Subscription_Plans_Select_Column_Subscription_Plans_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
  filter?: InputMaybe<Subscription_Plans_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Subscription_Plans_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Subscription_Plans_Select_Column_Subscription_Plans_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
  filter?: InputMaybe<Subscription_Plans_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Subscription_Plans_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Subscription_Plans_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
  filter?: InputMaybe<Subscription_Plans_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "subscription_plans" */
export type Subscription_Plans_Aggregate_Fields = {
  __typename?: "subscription_plans_aggregate_fields";
  avg?: Maybe<Subscription_Plans_Avg_Fields>;
  count: Scalars["Int"]["output"];
  max?: Maybe<Subscription_Plans_Max_Fields>;
  min?: Maybe<Subscription_Plans_Min_Fields>;
  stddev?: Maybe<Subscription_Plans_Stddev_Fields>;
  stddev_pop?: Maybe<Subscription_Plans_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Subscription_Plans_Stddev_Samp_Fields>;
  sum?: Maybe<Subscription_Plans_Sum_Fields>;
  var_pop?: Maybe<Subscription_Plans_Var_Pop_Fields>;
  var_samp?: Maybe<Subscription_Plans_Var_Samp_Fields>;
  variance?: Maybe<Subscription_Plans_Variance_Fields>;
};

/** aggregate fields of "subscription_plans" */
export type Subscription_Plans_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Subscription_Plans_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** order by aggregate values of table "subscription_plans" */
export type Subscription_Plans_Aggregate_Order_By = {
  avg?: InputMaybe<Subscription_Plans_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Subscription_Plans_Max_Order_By>;
  min?: InputMaybe<Subscription_Plans_Min_Order_By>;
  stddev?: InputMaybe<Subscription_Plans_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Subscription_Plans_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Subscription_Plans_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Subscription_Plans_Sum_Order_By>;
  var_pop?: InputMaybe<Subscription_Plans_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Subscription_Plans_Var_Samp_Order_By>;
  variance?: InputMaybe<Subscription_Plans_Variance_Order_By>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Subscription_Plans_Append_Input = {
  features?: InputMaybe<Scalars["jsonb"]["input"]>;
  metadata?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** input type for inserting array relation for remote table "subscription_plans" */
export type Subscription_Plans_Arr_Rel_Insert_Input = {
  data: Array<Subscription_Plans_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Subscription_Plans_On_Conflict>;
};

/** aggregate avg on columns */
export type Subscription_Plans_Avg_Fields = {
  __typename?: "subscription_plans_avg_fields";
  interval_count?: Maybe<Scalars["Float"]["output"]>;
  price?: Maybe<Scalars["Float"]["output"]>;
  trial_period_days?: Maybe<Scalars["Float"]["output"]>;
};

/** order by avg() on columns of table "subscription_plans" */
export type Subscription_Plans_Avg_Order_By = {
  interval_count?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  trial_period_days?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "subscription_plans". All fields are combined with a logical 'AND'. */
export type Subscription_Plans_Bool_Exp = {
  _and?: InputMaybe<Array<Subscription_Plans_Bool_Exp>>;
  _hasyx_schema_name?: InputMaybe<String_Comparison_Exp>;
  _hasyx_table_name?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Subscription_Plans_Bool_Exp>;
  _or?: InputMaybe<Array<Subscription_Plans_Bool_Exp>>;
  active?: InputMaybe<Boolean_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  currency?: InputMaybe<String_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  features?: InputMaybe<Jsonb_Comparison_Exp>;
  hasyx?: InputMaybe<Hasyx_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  interval?: InputMaybe<String_Comparison_Exp>;
  interval_count?: InputMaybe<Int_Comparison_Exp>;
  metadata?: InputMaybe<Jsonb_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  price?: InputMaybe<Numeric_Comparison_Exp>;
  subscriptions?: InputMaybe<Subscriptions_Bool_Exp>;
  subscriptions_aggregate?: InputMaybe<Subscriptions_Aggregate_Bool_Exp>;
  trial_period_days?: InputMaybe<Int_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  user_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "subscription_plans" */
export enum Subscription_Plans_Constraint {
  /** unique or primary key constraint on columns "id" */
  SubscriptionPlansPkey = "subscription_plans_pkey",
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Subscription_Plans_Delete_At_Path_Input = {
  features?: InputMaybe<Array<Scalars["String"]["input"]>>;
  metadata?: InputMaybe<Array<Scalars["String"]["input"]>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Subscription_Plans_Delete_Elem_Input = {
  features?: InputMaybe<Scalars["Int"]["input"]>;
  metadata?: InputMaybe<Scalars["Int"]["input"]>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Subscription_Plans_Delete_Key_Input = {
  features?: InputMaybe<Scalars["String"]["input"]>;
  metadata?: InputMaybe<Scalars["String"]["input"]>;
};

/** input type for incrementing numeric columns in table "subscription_plans" */
export type Subscription_Plans_Inc_Input = {
  interval_count?: InputMaybe<Scalars["Int"]["input"]>;
  price?: InputMaybe<Scalars["numeric"]["input"]>;
  trial_period_days?: InputMaybe<Scalars["Int"]["input"]>;
};

/** input type for inserting data into table "subscription_plans" */
export type Subscription_Plans_Insert_Input = {
  /** Whether this plan can be subscribed to currently */
  active?: InputMaybe<Scalars["Boolean"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  description?: InputMaybe<Scalars["String"]["input"]>;
  features?: InputMaybe<Scalars["jsonb"]["input"]>;
  hasyx?: InputMaybe<Hasyx_Obj_Rel_Insert_Input>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  /** e.g., "day", "week", "month", "year" */
  interval?: InputMaybe<Scalars["String"]["input"]>;
  interval_count?: InputMaybe<Scalars["Int"]["input"]>;
  metadata?: InputMaybe<Scalars["jsonb"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  price?: InputMaybe<Scalars["numeric"]["input"]>;
  subscriptions?: InputMaybe<Subscriptions_Arr_Rel_Insert_Input>;
  trial_period_days?: InputMaybe<Scalars["Int"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  /** If NULL, the plan is publicly available. Otherwise, it is custom for the user. */
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** aggregate max on columns */
export type Subscription_Plans_Max_Fields = {
  __typename?: "subscription_plans_max_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  currency?: Maybe<Scalars["String"]["output"]>;
  description?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  /** e.g., "day", "week", "month", "year" */
  interval?: Maybe<Scalars["String"]["output"]>;
  interval_count?: Maybe<Scalars["Int"]["output"]>;
  name?: Maybe<Scalars["String"]["output"]>;
  price?: Maybe<Scalars["numeric"]["output"]>;
  trial_period_days?: Maybe<Scalars["Int"]["output"]>;
  updated_at?: Maybe<Scalars["timestamptz"]["output"]>;
  /** If NULL, the plan is publicly available. Otherwise, it is custom for the user. */
  user_id?: Maybe<Scalars["uuid"]["output"]>;
};

/** order by max() on columns of table "subscription_plans" */
export type Subscription_Plans_Max_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** e.g., "day", "week", "month", "year" */
  interval?: InputMaybe<Order_By>;
  interval_count?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  trial_period_days?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  /** If NULL, the plan is publicly available. Otherwise, it is custom for the user. */
  user_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Subscription_Plans_Min_Fields = {
  __typename?: "subscription_plans_min_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  currency?: Maybe<Scalars["String"]["output"]>;
  description?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  /** e.g., "day", "week", "month", "year" */
  interval?: Maybe<Scalars["String"]["output"]>;
  interval_count?: Maybe<Scalars["Int"]["output"]>;
  name?: Maybe<Scalars["String"]["output"]>;
  price?: Maybe<Scalars["numeric"]["output"]>;
  trial_period_days?: Maybe<Scalars["Int"]["output"]>;
  updated_at?: Maybe<Scalars["timestamptz"]["output"]>;
  /** If NULL, the plan is publicly available. Otherwise, it is custom for the user. */
  user_id?: Maybe<Scalars["uuid"]["output"]>;
};

/** order by min() on columns of table "subscription_plans" */
export type Subscription_Plans_Min_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** e.g., "day", "week", "month", "year" */
  interval?: InputMaybe<Order_By>;
  interval_count?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  trial_period_days?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  /** If NULL, the plan is publicly available. Otherwise, it is custom for the user. */
  user_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "subscription_plans" */
export type Subscription_Plans_Mutation_Response = {
  __typename?: "subscription_plans_mutation_response";
  /** number of rows affected by the mutation */
  affected_rows: Scalars["Int"]["output"];
  /** data from the rows affected by the mutation */
  returning: Array<Subscription_Plans>;
};

/** input type for inserting object relation for remote table "subscription_plans" */
export type Subscription_Plans_Obj_Rel_Insert_Input = {
  data: Subscription_Plans_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Subscription_Plans_On_Conflict>;
};

/** on_conflict condition type for table "subscription_plans" */
export type Subscription_Plans_On_Conflict = {
  constraint: Subscription_Plans_Constraint;
  update_columns?: Array<Subscription_Plans_Update_Column>;
  where?: InputMaybe<Subscription_Plans_Bool_Exp>;
};

/** Ordering options when selecting data from "subscription_plans". */
export type Subscription_Plans_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  active?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  features?: InputMaybe<Order_By>;
  hasyx?: InputMaybe<Hasyx_Order_By>;
  id?: InputMaybe<Order_By>;
  interval?: InputMaybe<Order_By>;
  interval_count?: InputMaybe<Order_By>;
  metadata?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  subscriptions_aggregate?: InputMaybe<Subscriptions_Aggregate_Order_By>;
  trial_period_days?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: subscription_plans */
export type Subscription_Plans_Pk_Columns_Input = {
  id: Scalars["uuid"]["input"];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Subscription_Plans_Prepend_Input = {
  features?: InputMaybe<Scalars["jsonb"]["input"]>;
  metadata?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** select columns of table "subscription_plans" */
export enum Subscription_Plans_Select_Column {
  /** column name */
  HasyxSchemaName = "_hasyx_schema_name",
  /** column name */
  HasyxTableName = "_hasyx_table_name",
  /** column name */
  Active = "active",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  Currency = "currency",
  /** column name */
  Description = "description",
  /** column name */
  Features = "features",
  /** column name */
  Id = "id",
  /** column name */
  Interval = "interval",
  /** column name */
  IntervalCount = "interval_count",
  /** column name */
  Metadata = "metadata",
  /** column name */
  Name = "name",
  /** column name */
  Price = "price",
  /** column name */
  TrialPeriodDays = "trial_period_days",
  /** column name */
  UpdatedAt = "updated_at",
  /** column name */
  UserId = "user_id",
}

/** select "subscription_plans_aggregate_bool_exp_bool_and_arguments_columns" columns of table "subscription_plans" */
export enum Subscription_Plans_Select_Column_Subscription_Plans_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  Active = "active",
}

/** select "subscription_plans_aggregate_bool_exp_bool_or_arguments_columns" columns of table "subscription_plans" */
export enum Subscription_Plans_Select_Column_Subscription_Plans_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  Active = "active",
}

/** input type for updating data in table "subscription_plans" */
export type Subscription_Plans_Set_Input = {
  /** Whether this plan can be subscribed to currently */
  active?: InputMaybe<Scalars["Boolean"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  description?: InputMaybe<Scalars["String"]["input"]>;
  features?: InputMaybe<Scalars["jsonb"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  /** e.g., "day", "week", "month", "year" */
  interval?: InputMaybe<Scalars["String"]["input"]>;
  interval_count?: InputMaybe<Scalars["Int"]["input"]>;
  metadata?: InputMaybe<Scalars["jsonb"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  price?: InputMaybe<Scalars["numeric"]["input"]>;
  trial_period_days?: InputMaybe<Scalars["Int"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  /** If NULL, the plan is publicly available. Otherwise, it is custom for the user. */
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** aggregate stddev on columns */
export type Subscription_Plans_Stddev_Fields = {
  __typename?: "subscription_plans_stddev_fields";
  interval_count?: Maybe<Scalars["Float"]["output"]>;
  price?: Maybe<Scalars["Float"]["output"]>;
  trial_period_days?: Maybe<Scalars["Float"]["output"]>;
};

/** order by stddev() on columns of table "subscription_plans" */
export type Subscription_Plans_Stddev_Order_By = {
  interval_count?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  trial_period_days?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Subscription_Plans_Stddev_Pop_Fields = {
  __typename?: "subscription_plans_stddev_pop_fields";
  interval_count?: Maybe<Scalars["Float"]["output"]>;
  price?: Maybe<Scalars["Float"]["output"]>;
  trial_period_days?: Maybe<Scalars["Float"]["output"]>;
};

/** order by stddev_pop() on columns of table "subscription_plans" */
export type Subscription_Plans_Stddev_Pop_Order_By = {
  interval_count?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  trial_period_days?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Subscription_Plans_Stddev_Samp_Fields = {
  __typename?: "subscription_plans_stddev_samp_fields";
  interval_count?: Maybe<Scalars["Float"]["output"]>;
  price?: Maybe<Scalars["Float"]["output"]>;
  trial_period_days?: Maybe<Scalars["Float"]["output"]>;
};

/** order by stddev_samp() on columns of table "subscription_plans" */
export type Subscription_Plans_Stddev_Samp_Order_By = {
  interval_count?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  trial_period_days?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "subscription_plans" */
export type Subscription_Plans_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Subscription_Plans_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Subscription_Plans_Stream_Cursor_Value_Input = {
  _hasyx_schema_name?: InputMaybe<Scalars["String"]["input"]>;
  _hasyx_table_name?: InputMaybe<Scalars["String"]["input"]>;
  /** Whether this plan can be subscribed to currently */
  active?: InputMaybe<Scalars["Boolean"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  description?: InputMaybe<Scalars["String"]["input"]>;
  features?: InputMaybe<Scalars["jsonb"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  /** e.g., "day", "week", "month", "year" */
  interval?: InputMaybe<Scalars["String"]["input"]>;
  interval_count?: InputMaybe<Scalars["Int"]["input"]>;
  metadata?: InputMaybe<Scalars["jsonb"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  price?: InputMaybe<Scalars["numeric"]["input"]>;
  trial_period_days?: InputMaybe<Scalars["Int"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  /** If NULL, the plan is publicly available. Otherwise, it is custom for the user. */
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** aggregate sum on columns */
export type Subscription_Plans_Sum_Fields = {
  __typename?: "subscription_plans_sum_fields";
  interval_count?: Maybe<Scalars["Int"]["output"]>;
  price?: Maybe<Scalars["numeric"]["output"]>;
  trial_period_days?: Maybe<Scalars["Int"]["output"]>;
};

/** order by sum() on columns of table "subscription_plans" */
export type Subscription_Plans_Sum_Order_By = {
  interval_count?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  trial_period_days?: InputMaybe<Order_By>;
};

/** update columns of table "subscription_plans" */
export enum Subscription_Plans_Update_Column {
  /** column name */
  Active = "active",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  Currency = "currency",
  /** column name */
  Description = "description",
  /** column name */
  Features = "features",
  /** column name */
  Id = "id",
  /** column name */
  Interval = "interval",
  /** column name */
  IntervalCount = "interval_count",
  /** column name */
  Metadata = "metadata",
  /** column name */
  Name = "name",
  /** column name */
  Price = "price",
  /** column name */
  TrialPeriodDays = "trial_period_days",
  /** column name */
  UpdatedAt = "updated_at",
  /** column name */
  UserId = "user_id",
}

export type Subscription_Plans_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Subscription_Plans_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Subscription_Plans_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Subscription_Plans_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Subscription_Plans_Delete_Key_Input>;
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Subscription_Plans_Inc_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Subscription_Plans_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Subscription_Plans_Set_Input>;
  /** filter the rows which have to be updated */
  where: Subscription_Plans_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Subscription_Plans_Var_Pop_Fields = {
  __typename?: "subscription_plans_var_pop_fields";
  interval_count?: Maybe<Scalars["Float"]["output"]>;
  price?: Maybe<Scalars["Float"]["output"]>;
  trial_period_days?: Maybe<Scalars["Float"]["output"]>;
};

/** order by var_pop() on columns of table "subscription_plans" */
export type Subscription_Plans_Var_Pop_Order_By = {
  interval_count?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  trial_period_days?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Subscription_Plans_Var_Samp_Fields = {
  __typename?: "subscription_plans_var_samp_fields";
  interval_count?: Maybe<Scalars["Float"]["output"]>;
  price?: Maybe<Scalars["Float"]["output"]>;
  trial_period_days?: Maybe<Scalars["Float"]["output"]>;
};

/** order by var_samp() on columns of table "subscription_plans" */
export type Subscription_Plans_Var_Samp_Order_By = {
  interval_count?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  trial_period_days?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Subscription_Plans_Variance_Fields = {
  __typename?: "subscription_plans_variance_fields";
  interval_count?: Maybe<Scalars["Float"]["output"]>;
  price?: Maybe<Scalars["Float"]["output"]>;
  trial_period_days?: Maybe<Scalars["Float"]["output"]>;
};

/** order by variance() on columns of table "subscription_plans" */
export type Subscription_Plans_Variance_Order_By = {
  interval_count?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  trial_period_days?: InputMaybe<Order_By>;
};

export type Subscription_Root = {
  __typename?: "subscription_root";
  /** An array relationship */
  accounts: Array<Accounts>;
  /** An aggregate relationship */
  accounts_aggregate: Accounts_Aggregate;
  /** fetch data from the table: "accounts" using primary key columns */
  accounts_by_pk?: Maybe<Accounts>;
  /** fetch data from the table in a streaming manner: "accounts" */
  accounts_stream: Array<Accounts>;
  /** fetch data from the table: "debug" */
  debug: Array<Debug>;
  /** fetch aggregated fields from the table: "debug" */
  debug_aggregate: Debug_Aggregate;
  /** fetch data from the table: "debug" using primary key columns */
  debug_by_pk?: Maybe<Debug>;
  /** fetch data from the table in a streaming manner: "debug" */
  debug_stream: Array<Debug>;
  /** fetch data from the table: "hasyx" */
  hasyx: Array<Hasyx>;
  /** fetch aggregated fields from the table: "hasyx" */
  hasyx_aggregate: Hasyx_Aggregate;
  /** fetch data from the table in a streaming manner: "hasyx" */
  hasyx_stream: Array<Hasyx>;
  /** An array relationship */
  notification_messages: Array<Notification_Messages>;
  /** An aggregate relationship */
  notification_messages_aggregate: Notification_Messages_Aggregate;
  /** fetch data from the table: "notification_messages" using primary key columns */
  notification_messages_by_pk?: Maybe<Notification_Messages>;
  /** fetch data from the table in a streaming manner: "notification_messages" */
  notification_messages_stream: Array<Notification_Messages>;
  /** An array relationship */
  notification_permissions: Array<Notification_Permissions>;
  /** An aggregate relationship */
  notification_permissions_aggregate: Notification_Permissions_Aggregate;
  /** fetch data from the table: "notification_permissions" using primary key columns */
  notification_permissions_by_pk?: Maybe<Notification_Permissions>;
  /** fetch data from the table in a streaming manner: "notification_permissions" */
  notification_permissions_stream: Array<Notification_Permissions>;
  /** An array relationship */
  notifications: Array<Notifications>;
  /** An aggregate relationship */
  notifications_aggregate: Notifications_Aggregate;
  /** fetch data from the table: "notifications" using primary key columns */
  notifications_by_pk?: Maybe<Notifications>;
  /** fetch data from the table in a streaming manner: "notifications" */
  notifications_stream: Array<Notifications>;
  /** An array relationship */
  payment_methods: Array<Payment_Methods>;
  /** An aggregate relationship */
  payment_methods_aggregate: Payment_Methods_Aggregate;
  /** fetch data from the table: "payment_methods" using primary key columns */
  payment_methods_by_pk?: Maybe<Payment_Methods>;
  /** fetch data from the table in a streaming manner: "payment_methods" */
  payment_methods_stream: Array<Payment_Methods>;
  /** An array relationship */
  payments: Array<Payments>;
  /** An aggregate relationship */
  payments_aggregate: Payments_Aggregate;
  /** fetch data from the table: "payments" using primary key columns */
  payments_by_pk?: Maybe<Payments>;
  /** fetch data from the table in a streaming manner: "payments" */
  payments_stream: Array<Payments>;
  /** fetch data from the table: "subscription_plans" */
  subscription_plans: Array<Subscription_Plans>;
  /** fetch aggregated fields from the table: "subscription_plans" */
  subscription_plans_aggregate: Subscription_Plans_Aggregate;
  /** fetch data from the table: "subscription_plans" using primary key columns */
  subscription_plans_by_pk?: Maybe<Subscription_Plans>;
  /** fetch data from the table in a streaming manner: "subscription_plans" */
  subscription_plans_stream: Array<Subscription_Plans>;
  /** An array relationship */
  subscriptions: Array<Subscriptions>;
  /** An aggregate relationship */
  subscriptions_aggregate: Subscriptions_Aggregate;
  /** fetch data from the table: "subscriptions" using primary key columns */
  subscriptions_by_pk?: Maybe<Subscriptions>;
  /** fetch data from the table in a streaming manner: "subscriptions" */
  subscriptions_stream: Array<Subscriptions>;
  /** fetch data from the table: "users" */
  users: Array<Users>;
  /** fetch aggregated fields from the table: "users" */
  users_aggregate: Users_Aggregate;
  /** fetch data from the table: "users" using primary key columns */
  users_by_pk?: Maybe<Users>;
  /** fetch data from the table in a streaming manner: "users" */
  users_stream: Array<Users>;
};

export type Subscription_RootAccountsArgs = {
  distinct_on?: InputMaybe<Array<Accounts_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Accounts_Order_By>>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};

export type Subscription_RootAccounts_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Accounts_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Accounts_Order_By>>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};

export type Subscription_RootAccounts_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Subscription_RootAccounts_StreamArgs = {
  batch_size: Scalars["Int"]["input"];
  cursor: Array<InputMaybe<Accounts_Stream_Cursor_Input>>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};

export type Subscription_RootDebugArgs = {
  distinct_on?: InputMaybe<Array<Debug_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Debug_Order_By>>;
  where?: InputMaybe<Debug_Bool_Exp>;
};

export type Subscription_RootDebug_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Debug_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Debug_Order_By>>;
  where?: InputMaybe<Debug_Bool_Exp>;
};

export type Subscription_RootDebug_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Subscription_RootDebug_StreamArgs = {
  batch_size: Scalars["Int"]["input"];
  cursor: Array<InputMaybe<Debug_Stream_Cursor_Input>>;
  where?: InputMaybe<Debug_Bool_Exp>;
};

export type Subscription_RootHasyxArgs = {
  distinct_on?: InputMaybe<Array<Hasyx_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Hasyx_Order_By>>;
  where?: InputMaybe<Hasyx_Bool_Exp>;
};

export type Subscription_RootHasyx_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Hasyx_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Hasyx_Order_By>>;
  where?: InputMaybe<Hasyx_Bool_Exp>;
};

export type Subscription_RootHasyx_StreamArgs = {
  batch_size: Scalars["Int"]["input"];
  cursor: Array<InputMaybe<Hasyx_Stream_Cursor_Input>>;
  where?: InputMaybe<Hasyx_Bool_Exp>;
};

export type Subscription_RootNotification_MessagesArgs = {
  distinct_on?: InputMaybe<Array<Notification_Messages_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notification_Messages_Order_By>>;
  where?: InputMaybe<Notification_Messages_Bool_Exp>;
};

export type Subscription_RootNotification_Messages_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Notification_Messages_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notification_Messages_Order_By>>;
  where?: InputMaybe<Notification_Messages_Bool_Exp>;
};

export type Subscription_RootNotification_Messages_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Subscription_RootNotification_Messages_StreamArgs = {
  batch_size: Scalars["Int"]["input"];
  cursor: Array<InputMaybe<Notification_Messages_Stream_Cursor_Input>>;
  where?: InputMaybe<Notification_Messages_Bool_Exp>;
};

export type Subscription_RootNotification_PermissionsArgs = {
  distinct_on?: InputMaybe<Array<Notification_Permissions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notification_Permissions_Order_By>>;
  where?: InputMaybe<Notification_Permissions_Bool_Exp>;
};

export type Subscription_RootNotification_Permissions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Notification_Permissions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notification_Permissions_Order_By>>;
  where?: InputMaybe<Notification_Permissions_Bool_Exp>;
};

export type Subscription_RootNotification_Permissions_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Subscription_RootNotification_Permissions_StreamArgs = {
  batch_size: Scalars["Int"]["input"];
  cursor: Array<InputMaybe<Notification_Permissions_Stream_Cursor_Input>>;
  where?: InputMaybe<Notification_Permissions_Bool_Exp>;
};

export type Subscription_RootNotificationsArgs = {
  distinct_on?: InputMaybe<Array<Notifications_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notifications_Order_By>>;
  where?: InputMaybe<Notifications_Bool_Exp>;
};

export type Subscription_RootNotifications_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Notifications_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notifications_Order_By>>;
  where?: InputMaybe<Notifications_Bool_Exp>;
};

export type Subscription_RootNotifications_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Subscription_RootNotifications_StreamArgs = {
  batch_size: Scalars["Int"]["input"];
  cursor: Array<InputMaybe<Notifications_Stream_Cursor_Input>>;
  where?: InputMaybe<Notifications_Bool_Exp>;
};

export type Subscription_RootPayment_MethodsArgs = {
  distinct_on?: InputMaybe<Array<Payment_Methods_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payment_Methods_Order_By>>;
  where?: InputMaybe<Payment_Methods_Bool_Exp>;
};

export type Subscription_RootPayment_Methods_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Payment_Methods_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payment_Methods_Order_By>>;
  where?: InputMaybe<Payment_Methods_Bool_Exp>;
};

export type Subscription_RootPayment_Methods_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Subscription_RootPayment_Methods_StreamArgs = {
  batch_size: Scalars["Int"]["input"];
  cursor: Array<InputMaybe<Payment_Methods_Stream_Cursor_Input>>;
  where?: InputMaybe<Payment_Methods_Bool_Exp>;
};

export type Subscription_RootPaymentsArgs = {
  distinct_on?: InputMaybe<Array<Payments_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payments_Order_By>>;
  where?: InputMaybe<Payments_Bool_Exp>;
};

export type Subscription_RootPayments_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Payments_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payments_Order_By>>;
  where?: InputMaybe<Payments_Bool_Exp>;
};

export type Subscription_RootPayments_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Subscription_RootPayments_StreamArgs = {
  batch_size: Scalars["Int"]["input"];
  cursor: Array<InputMaybe<Payments_Stream_Cursor_Input>>;
  where?: InputMaybe<Payments_Bool_Exp>;
};

export type Subscription_RootSubscription_PlansArgs = {
  distinct_on?: InputMaybe<Array<Subscription_Plans_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscription_Plans_Order_By>>;
  where?: InputMaybe<Subscription_Plans_Bool_Exp>;
};

export type Subscription_RootSubscription_Plans_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Subscription_Plans_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscription_Plans_Order_By>>;
  where?: InputMaybe<Subscription_Plans_Bool_Exp>;
};

export type Subscription_RootSubscription_Plans_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Subscription_RootSubscription_Plans_StreamArgs = {
  batch_size: Scalars["Int"]["input"];
  cursor: Array<InputMaybe<Subscription_Plans_Stream_Cursor_Input>>;
  where?: InputMaybe<Subscription_Plans_Bool_Exp>;
};

export type Subscription_RootSubscriptionsArgs = {
  distinct_on?: InputMaybe<Array<Subscriptions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscriptions_Order_By>>;
  where?: InputMaybe<Subscriptions_Bool_Exp>;
};

export type Subscription_RootSubscriptions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Subscriptions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscriptions_Order_By>>;
  where?: InputMaybe<Subscriptions_Bool_Exp>;
};

export type Subscription_RootSubscriptions_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Subscription_RootSubscriptions_StreamArgs = {
  batch_size: Scalars["Int"]["input"];
  cursor: Array<InputMaybe<Subscriptions_Stream_Cursor_Input>>;
  where?: InputMaybe<Subscriptions_Bool_Exp>;
};

export type Subscription_RootUsersArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};

export type Subscription_RootUsers_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};

export type Subscription_RootUsers_By_PkArgs = {
  id: Scalars["uuid"]["input"];
};

export type Subscription_RootUsers_StreamArgs = {
  batch_size: Scalars["Int"]["input"];
  cursor: Array<InputMaybe<Users_Stream_Cursor_Input>>;
  where?: InputMaybe<Users_Bool_Exp>;
};

/** columns and relationships of "subscriptions" */
export type Subscriptions = {
  __typename?: "subscriptions";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  cancel_at_period_end: Scalars["Boolean"]["output"];
  canceled_at?: Maybe<Scalars["timestamptz"]["output"]>;
  created_at: Scalars["timestamptz"]["output"];
  current_period_end?: Maybe<Scalars["timestamptz"]["output"]>;
  current_period_start?: Maybe<Scalars["timestamptz"]["output"]>;
  ended_at?: Maybe<Scalars["timestamptz"]["output"]>;
  /** Subscription ID in the external system, if any */
  external_subscription_id?: Maybe<Scalars["String"]["output"]>;
  /** An object relationship */
  hasyx?: Maybe<Hasyx>;
  id: Scalars["uuid"]["output"];
  metadata?: Maybe<Scalars["jsonb"]["output"]>;
  object_hid?: Maybe<Scalars["String"]["output"]>;
  /** An object relationship */
  payment_method: Payment_Methods;
  payment_method_id: Scalars["uuid"]["output"];
  /** An array relationship */
  payments: Array<Payments>;
  /** An aggregate relationship */
  payments_aggregate: Payments_Aggregate;
  /** An object relationship */
  plan?: Maybe<Subscription_Plans>;
  plan_id?: Maybe<Scalars["uuid"]["output"]>;
  /** e.g., "tbank", "internal" */
  provider_name: Scalars["String"]["output"];
  /** e.g., "trialing", "active", "past_due", "unpaid", "canceled", "ended", "paused" */
  status: Scalars["String"]["output"];
  trial_ends_at?: Maybe<Scalars["timestamptz"]["output"]>;
  updated_at: Scalars["timestamptz"]["output"];
  /** An object relationship */
  user: Users;
  user_id: Scalars["uuid"]["output"];
};

/** columns and relationships of "subscriptions" */
export type SubscriptionsMetadataArgs = {
  path?: InputMaybe<Scalars["String"]["input"]>;
};

/** columns and relationships of "subscriptions" */
export type SubscriptionsPaymentsArgs = {
  distinct_on?: InputMaybe<Array<Payments_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payments_Order_By>>;
  where?: InputMaybe<Payments_Bool_Exp>;
};

/** columns and relationships of "subscriptions" */
export type SubscriptionsPayments_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Payments_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payments_Order_By>>;
  where?: InputMaybe<Payments_Bool_Exp>;
};

/** aggregated selection of "subscriptions" */
export type Subscriptions_Aggregate = {
  __typename?: "subscriptions_aggregate";
  aggregate?: Maybe<Subscriptions_Aggregate_Fields>;
  nodes: Array<Subscriptions>;
};

export type Subscriptions_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Subscriptions_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Subscriptions_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Subscriptions_Aggregate_Bool_Exp_Count>;
};

export type Subscriptions_Aggregate_Bool_Exp_Bool_And = {
  arguments: Subscriptions_Select_Column_Subscriptions_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
  filter?: InputMaybe<Subscriptions_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Subscriptions_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Subscriptions_Select_Column_Subscriptions_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
  filter?: InputMaybe<Subscriptions_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Subscriptions_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Subscriptions_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
  filter?: InputMaybe<Subscriptions_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "subscriptions" */
export type Subscriptions_Aggregate_Fields = {
  __typename?: "subscriptions_aggregate_fields";
  count: Scalars["Int"]["output"];
  max?: Maybe<Subscriptions_Max_Fields>;
  min?: Maybe<Subscriptions_Min_Fields>;
};

/** aggregate fields of "subscriptions" */
export type Subscriptions_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Subscriptions_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** order by aggregate values of table "subscriptions" */
export type Subscriptions_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Subscriptions_Max_Order_By>;
  min?: InputMaybe<Subscriptions_Min_Order_By>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Subscriptions_Append_Input = {
  metadata?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** input type for inserting array relation for remote table "subscriptions" */
export type Subscriptions_Arr_Rel_Insert_Input = {
  data: Array<Subscriptions_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Subscriptions_On_Conflict>;
};

/** Boolean expression to filter rows from the table "subscriptions". All fields are combined with a logical 'AND'. */
export type Subscriptions_Bool_Exp = {
  _and?: InputMaybe<Array<Subscriptions_Bool_Exp>>;
  _hasyx_schema_name?: InputMaybe<String_Comparison_Exp>;
  _hasyx_table_name?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Subscriptions_Bool_Exp>;
  _or?: InputMaybe<Array<Subscriptions_Bool_Exp>>;
  cancel_at_period_end?: InputMaybe<Boolean_Comparison_Exp>;
  canceled_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  current_period_end?: InputMaybe<Timestamptz_Comparison_Exp>;
  current_period_start?: InputMaybe<Timestamptz_Comparison_Exp>;
  ended_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  external_subscription_id?: InputMaybe<String_Comparison_Exp>;
  hasyx?: InputMaybe<Hasyx_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  metadata?: InputMaybe<Jsonb_Comparison_Exp>;
  object_hid?: InputMaybe<String_Comparison_Exp>;
  payment_method?: InputMaybe<Payment_Methods_Bool_Exp>;
  payment_method_id?: InputMaybe<Uuid_Comparison_Exp>;
  payments?: InputMaybe<Payments_Bool_Exp>;
  payments_aggregate?: InputMaybe<Payments_Aggregate_Bool_Exp>;
  plan?: InputMaybe<Subscription_Plans_Bool_Exp>;
  plan_id?: InputMaybe<Uuid_Comparison_Exp>;
  provider_name?: InputMaybe<String_Comparison_Exp>;
  status?: InputMaybe<String_Comparison_Exp>;
  trial_ends_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  user_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "subscriptions" */
export enum Subscriptions_Constraint {
  /** unique or primary key constraint on columns "id" */
  SubscriptionsPkey = "subscriptions_pkey",
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Subscriptions_Delete_At_Path_Input = {
  metadata?: InputMaybe<Array<Scalars["String"]["input"]>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Subscriptions_Delete_Elem_Input = {
  metadata?: InputMaybe<Scalars["Int"]["input"]>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Subscriptions_Delete_Key_Input = {
  metadata?: InputMaybe<Scalars["String"]["input"]>;
};

/** input type for inserting data into table "subscriptions" */
export type Subscriptions_Insert_Input = {
  cancel_at_period_end?: InputMaybe<Scalars["Boolean"]["input"]>;
  canceled_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  current_period_end?: InputMaybe<Scalars["timestamptz"]["input"]>;
  current_period_start?: InputMaybe<Scalars["timestamptz"]["input"]>;
  ended_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  /** Subscription ID in the external system, if any */
  external_subscription_id?: InputMaybe<Scalars["String"]["input"]>;
  hasyx?: InputMaybe<Hasyx_Obj_Rel_Insert_Input>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  metadata?: InputMaybe<Scalars["jsonb"]["input"]>;
  object_hid?: InputMaybe<Scalars["String"]["input"]>;
  payment_method?: InputMaybe<Payment_Methods_Obj_Rel_Insert_Input>;
  payment_method_id?: InputMaybe<Scalars["uuid"]["input"]>;
  payments?: InputMaybe<Payments_Arr_Rel_Insert_Input>;
  plan?: InputMaybe<Subscription_Plans_Obj_Rel_Insert_Input>;
  plan_id?: InputMaybe<Scalars["uuid"]["input"]>;
  /** e.g., "tbank", "internal" */
  provider_name?: InputMaybe<Scalars["String"]["input"]>;
  /** e.g., "trialing", "active", "past_due", "unpaid", "canceled", "ended", "paused" */
  status?: InputMaybe<Scalars["String"]["input"]>;
  trial_ends_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** aggregate max on columns */
export type Subscriptions_Max_Fields = {
  __typename?: "subscriptions_max_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  canceled_at?: Maybe<Scalars["timestamptz"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  current_period_end?: Maybe<Scalars["timestamptz"]["output"]>;
  current_period_start?: Maybe<Scalars["timestamptz"]["output"]>;
  ended_at?: Maybe<Scalars["timestamptz"]["output"]>;
  /** Subscription ID in the external system, if any */
  external_subscription_id?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  object_hid?: Maybe<Scalars["String"]["output"]>;
  payment_method_id?: Maybe<Scalars["uuid"]["output"]>;
  plan_id?: Maybe<Scalars["uuid"]["output"]>;
  /** e.g., "tbank", "internal" */
  provider_name?: Maybe<Scalars["String"]["output"]>;
  /** e.g., "trialing", "active", "past_due", "unpaid", "canceled", "ended", "paused" */
  status?: Maybe<Scalars["String"]["output"]>;
  trial_ends_at?: Maybe<Scalars["timestamptz"]["output"]>;
  updated_at?: Maybe<Scalars["timestamptz"]["output"]>;
  user_id?: Maybe<Scalars["uuid"]["output"]>;
};

/** order by max() on columns of table "subscriptions" */
export type Subscriptions_Max_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  canceled_at?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  current_period_end?: InputMaybe<Order_By>;
  current_period_start?: InputMaybe<Order_By>;
  ended_at?: InputMaybe<Order_By>;
  /** Subscription ID in the external system, if any */
  external_subscription_id?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  object_hid?: InputMaybe<Order_By>;
  payment_method_id?: InputMaybe<Order_By>;
  plan_id?: InputMaybe<Order_By>;
  /** e.g., "tbank", "internal" */
  provider_name?: InputMaybe<Order_By>;
  /** e.g., "trialing", "active", "past_due", "unpaid", "canceled", "ended", "paused" */
  status?: InputMaybe<Order_By>;
  trial_ends_at?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Subscriptions_Min_Fields = {
  __typename?: "subscriptions_min_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  canceled_at?: Maybe<Scalars["timestamptz"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  current_period_end?: Maybe<Scalars["timestamptz"]["output"]>;
  current_period_start?: Maybe<Scalars["timestamptz"]["output"]>;
  ended_at?: Maybe<Scalars["timestamptz"]["output"]>;
  /** Subscription ID in the external system, if any */
  external_subscription_id?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  object_hid?: Maybe<Scalars["String"]["output"]>;
  payment_method_id?: Maybe<Scalars["uuid"]["output"]>;
  plan_id?: Maybe<Scalars["uuid"]["output"]>;
  /** e.g., "tbank", "internal" */
  provider_name?: Maybe<Scalars["String"]["output"]>;
  /** e.g., "trialing", "active", "past_due", "unpaid", "canceled", "ended", "paused" */
  status?: Maybe<Scalars["String"]["output"]>;
  trial_ends_at?: Maybe<Scalars["timestamptz"]["output"]>;
  updated_at?: Maybe<Scalars["timestamptz"]["output"]>;
  user_id?: Maybe<Scalars["uuid"]["output"]>;
};

/** order by min() on columns of table "subscriptions" */
export type Subscriptions_Min_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  canceled_at?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  current_period_end?: InputMaybe<Order_By>;
  current_period_start?: InputMaybe<Order_By>;
  ended_at?: InputMaybe<Order_By>;
  /** Subscription ID in the external system, if any */
  external_subscription_id?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  object_hid?: InputMaybe<Order_By>;
  payment_method_id?: InputMaybe<Order_By>;
  plan_id?: InputMaybe<Order_By>;
  /** e.g., "tbank", "internal" */
  provider_name?: InputMaybe<Order_By>;
  /** e.g., "trialing", "active", "past_due", "unpaid", "canceled", "ended", "paused" */
  status?: InputMaybe<Order_By>;
  trial_ends_at?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "subscriptions" */
export type Subscriptions_Mutation_Response = {
  __typename?: "subscriptions_mutation_response";
  /** number of rows affected by the mutation */
  affected_rows: Scalars["Int"]["output"];
  /** data from the rows affected by the mutation */
  returning: Array<Subscriptions>;
};

/** input type for inserting object relation for remote table "subscriptions" */
export type Subscriptions_Obj_Rel_Insert_Input = {
  data: Subscriptions_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Subscriptions_On_Conflict>;
};

/** on_conflict condition type for table "subscriptions" */
export type Subscriptions_On_Conflict = {
  constraint: Subscriptions_Constraint;
  update_columns?: Array<Subscriptions_Update_Column>;
  where?: InputMaybe<Subscriptions_Bool_Exp>;
};

/** Ordering options when selecting data from "subscriptions". */
export type Subscriptions_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  cancel_at_period_end?: InputMaybe<Order_By>;
  canceled_at?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  current_period_end?: InputMaybe<Order_By>;
  current_period_start?: InputMaybe<Order_By>;
  ended_at?: InputMaybe<Order_By>;
  external_subscription_id?: InputMaybe<Order_By>;
  hasyx?: InputMaybe<Hasyx_Order_By>;
  id?: InputMaybe<Order_By>;
  metadata?: InputMaybe<Order_By>;
  object_hid?: InputMaybe<Order_By>;
  payment_method?: InputMaybe<Payment_Methods_Order_By>;
  payment_method_id?: InputMaybe<Order_By>;
  payments_aggregate?: InputMaybe<Payments_Aggregate_Order_By>;
  plan?: InputMaybe<Subscription_Plans_Order_By>;
  plan_id?: InputMaybe<Order_By>;
  provider_name?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  trial_ends_at?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: subscriptions */
export type Subscriptions_Pk_Columns_Input = {
  id: Scalars["uuid"]["input"];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Subscriptions_Prepend_Input = {
  metadata?: InputMaybe<Scalars["jsonb"]["input"]>;
};

/** select columns of table "subscriptions" */
export enum Subscriptions_Select_Column {
  /** column name */
  HasyxSchemaName = "_hasyx_schema_name",
  /** column name */
  HasyxTableName = "_hasyx_table_name",
  /** column name */
  CancelAtPeriodEnd = "cancel_at_period_end",
  /** column name */
  CanceledAt = "canceled_at",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  CurrentPeriodEnd = "current_period_end",
  /** column name */
  CurrentPeriodStart = "current_period_start",
  /** column name */
  EndedAt = "ended_at",
  /** column name */
  ExternalSubscriptionId = "external_subscription_id",
  /** column name */
  Id = "id",
  /** column name */
  Metadata = "metadata",
  /** column name */
  ObjectHid = "object_hid",
  /** column name */
  PaymentMethodId = "payment_method_id",
  /** column name */
  PlanId = "plan_id",
  /** column name */
  ProviderName = "provider_name",
  /** column name */
  Status = "status",
  /** column name */
  TrialEndsAt = "trial_ends_at",
  /** column name */
  UpdatedAt = "updated_at",
  /** column name */
  UserId = "user_id",
}

/** select "subscriptions_aggregate_bool_exp_bool_and_arguments_columns" columns of table "subscriptions" */
export enum Subscriptions_Select_Column_Subscriptions_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  CancelAtPeriodEnd = "cancel_at_period_end",
}

/** select "subscriptions_aggregate_bool_exp_bool_or_arguments_columns" columns of table "subscriptions" */
export enum Subscriptions_Select_Column_Subscriptions_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  CancelAtPeriodEnd = "cancel_at_period_end",
}

/** input type for updating data in table "subscriptions" */
export type Subscriptions_Set_Input = {
  cancel_at_period_end?: InputMaybe<Scalars["Boolean"]["input"]>;
  canceled_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  current_period_end?: InputMaybe<Scalars["timestamptz"]["input"]>;
  current_period_start?: InputMaybe<Scalars["timestamptz"]["input"]>;
  ended_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  /** Subscription ID in the external system, if any */
  external_subscription_id?: InputMaybe<Scalars["String"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  metadata?: InputMaybe<Scalars["jsonb"]["input"]>;
  object_hid?: InputMaybe<Scalars["String"]["input"]>;
  payment_method_id?: InputMaybe<Scalars["uuid"]["input"]>;
  plan_id?: InputMaybe<Scalars["uuid"]["input"]>;
  /** e.g., "tbank", "internal" */
  provider_name?: InputMaybe<Scalars["String"]["input"]>;
  /** e.g., "trialing", "active", "past_due", "unpaid", "canceled", "ended", "paused" */
  status?: InputMaybe<Scalars["String"]["input"]>;
  trial_ends_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** Streaming cursor of the table "subscriptions" */
export type Subscriptions_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Subscriptions_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Subscriptions_Stream_Cursor_Value_Input = {
  _hasyx_schema_name?: InputMaybe<Scalars["String"]["input"]>;
  _hasyx_table_name?: InputMaybe<Scalars["String"]["input"]>;
  cancel_at_period_end?: InputMaybe<Scalars["Boolean"]["input"]>;
  canceled_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  current_period_end?: InputMaybe<Scalars["timestamptz"]["input"]>;
  current_period_start?: InputMaybe<Scalars["timestamptz"]["input"]>;
  ended_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  /** Subscription ID in the external system, if any */
  external_subscription_id?: InputMaybe<Scalars["String"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  metadata?: InputMaybe<Scalars["jsonb"]["input"]>;
  object_hid?: InputMaybe<Scalars["String"]["input"]>;
  payment_method_id?: InputMaybe<Scalars["uuid"]["input"]>;
  plan_id?: InputMaybe<Scalars["uuid"]["input"]>;
  /** e.g., "tbank", "internal" */
  provider_name?: InputMaybe<Scalars["String"]["input"]>;
  /** e.g., "trialing", "active", "past_due", "unpaid", "canceled", "ended", "paused" */
  status?: InputMaybe<Scalars["String"]["input"]>;
  trial_ends_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  user_id?: InputMaybe<Scalars["uuid"]["input"]>;
};

/** update columns of table "subscriptions" */
export enum Subscriptions_Update_Column {
  /** column name */
  CancelAtPeriodEnd = "cancel_at_period_end",
  /** column name */
  CanceledAt = "canceled_at",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  CurrentPeriodEnd = "current_period_end",
  /** column name */
  CurrentPeriodStart = "current_period_start",
  /** column name */
  EndedAt = "ended_at",
  /** column name */
  ExternalSubscriptionId = "external_subscription_id",
  /** column name */
  Id = "id",
  /** column name */
  Metadata = "metadata",
  /** column name */
  ObjectHid = "object_hid",
  /** column name */
  PaymentMethodId = "payment_method_id",
  /** column name */
  PlanId = "plan_id",
  /** column name */
  ProviderName = "provider_name",
  /** column name */
  Status = "status",
  /** column name */
  TrialEndsAt = "trial_ends_at",
  /** column name */
  UpdatedAt = "updated_at",
  /** column name */
  UserId = "user_id",
}

export type Subscriptions_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Subscriptions_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Subscriptions_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Subscriptions_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Subscriptions_Delete_Key_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Subscriptions_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Subscriptions_Set_Input>;
  /** filter the rows which have to be updated */
  where: Subscriptions_Bool_Exp;
};

/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
export type Timestamptz_Comparison_Exp = {
  _eq?: InputMaybe<Scalars["timestamptz"]["input"]>;
  _gt?: InputMaybe<Scalars["timestamptz"]["input"]>;
  _gte?: InputMaybe<Scalars["timestamptz"]["input"]>;
  _in?: InputMaybe<Array<Scalars["timestamptz"]["input"]>>;
  _is_null?: InputMaybe<Scalars["Boolean"]["input"]>;
  _lt?: InputMaybe<Scalars["timestamptz"]["input"]>;
  _lte?: InputMaybe<Scalars["timestamptz"]["input"]>;
  _neq?: InputMaybe<Scalars["timestamptz"]["input"]>;
  _nin?: InputMaybe<Array<Scalars["timestamptz"]["input"]>>;
};

/** columns and relationships of "users" */
export type Users = {
  __typename?: "users";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  /** An array relationship */
  accounts: Array<Accounts>;
  /** An aggregate relationship */
  accounts_aggregate: Accounts_Aggregate;
  created_at: Scalars["timestamptz"]["output"];
  email?: Maybe<Scalars["String"]["output"]>;
  email_verified?: Maybe<Scalars["timestamptz"]["output"]>;
  hasura_role?: Maybe<Scalars["String"]["output"]>;
  /** An object relationship */
  hasyx?: Maybe<Hasyx>;
  id: Scalars["uuid"]["output"];
  image?: Maybe<Scalars["String"]["output"]>;
  is_admin?: Maybe<Scalars["Boolean"]["output"]>;
  name?: Maybe<Scalars["String"]["output"]>;
  /** An array relationship */
  notification_messages: Array<Notification_Messages>;
  /** An aggregate relationship */
  notification_messages_aggregate: Notification_Messages_Aggregate;
  /** An array relationship */
  notification_permissions: Array<Notification_Permissions>;
  /** An aggregate relationship */
  notification_permissions_aggregate: Notification_Permissions_Aggregate;
  password?: Maybe<Scalars["String"]["output"]>;
  /** An array relationship */
  payment_methods: Array<Payment_Methods>;
  /** An aggregate relationship */
  payment_methods_aggregate: Payment_Methods_Aggregate;
  /** An array relationship */
  payments: Array<Payments>;
  /** An aggregate relationship */
  payments_aggregate: Payments_Aggregate;
  /** An array relationship */
  subscription_plans_created: Array<Subscription_Plans>;
  /** An aggregate relationship */
  subscription_plans_created_aggregate: Subscription_Plans_Aggregate;
  /** An array relationship */
  subscriptions: Array<Subscriptions>;
  /** An aggregate relationship */
  subscriptions_aggregate: Subscriptions_Aggregate;
  updated_at: Scalars["timestamptz"]["output"];
};

/** columns and relationships of "users" */
export type UsersAccountsArgs = {
  distinct_on?: InputMaybe<Array<Accounts_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Accounts_Order_By>>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};

/** columns and relationships of "users" */
export type UsersAccounts_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Accounts_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Accounts_Order_By>>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};

/** columns and relationships of "users" */
export type UsersNotification_MessagesArgs = {
  distinct_on?: InputMaybe<Array<Notification_Messages_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notification_Messages_Order_By>>;
  where?: InputMaybe<Notification_Messages_Bool_Exp>;
};

/** columns and relationships of "users" */
export type UsersNotification_Messages_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Notification_Messages_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notification_Messages_Order_By>>;
  where?: InputMaybe<Notification_Messages_Bool_Exp>;
};

/** columns and relationships of "users" */
export type UsersNotification_PermissionsArgs = {
  distinct_on?: InputMaybe<Array<Notification_Permissions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notification_Permissions_Order_By>>;
  where?: InputMaybe<Notification_Permissions_Bool_Exp>;
};

/** columns and relationships of "users" */
export type UsersNotification_Permissions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Notification_Permissions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Notification_Permissions_Order_By>>;
  where?: InputMaybe<Notification_Permissions_Bool_Exp>;
};

/** columns and relationships of "users" */
export type UsersPayment_MethodsArgs = {
  distinct_on?: InputMaybe<Array<Payment_Methods_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payment_Methods_Order_By>>;
  where?: InputMaybe<Payment_Methods_Bool_Exp>;
};

/** columns and relationships of "users" */
export type UsersPayment_Methods_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Payment_Methods_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payment_Methods_Order_By>>;
  where?: InputMaybe<Payment_Methods_Bool_Exp>;
};

/** columns and relationships of "users" */
export type UsersPaymentsArgs = {
  distinct_on?: InputMaybe<Array<Payments_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payments_Order_By>>;
  where?: InputMaybe<Payments_Bool_Exp>;
};

/** columns and relationships of "users" */
export type UsersPayments_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Payments_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Payments_Order_By>>;
  where?: InputMaybe<Payments_Bool_Exp>;
};

/** columns and relationships of "users" */
export type UsersSubscription_Plans_CreatedArgs = {
  distinct_on?: InputMaybe<Array<Subscription_Plans_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscription_Plans_Order_By>>;
  where?: InputMaybe<Subscription_Plans_Bool_Exp>;
};

/** columns and relationships of "users" */
export type UsersSubscription_Plans_Created_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Subscription_Plans_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscription_Plans_Order_By>>;
  where?: InputMaybe<Subscription_Plans_Bool_Exp>;
};

/** columns and relationships of "users" */
export type UsersSubscriptionsArgs = {
  distinct_on?: InputMaybe<Array<Subscriptions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscriptions_Order_By>>;
  where?: InputMaybe<Subscriptions_Bool_Exp>;
};

/** columns and relationships of "users" */
export type UsersSubscriptions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Subscriptions_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subscriptions_Order_By>>;
  where?: InputMaybe<Subscriptions_Bool_Exp>;
};

/** aggregated selection of "users" */
export type Users_Aggregate = {
  __typename?: "users_aggregate";
  aggregate?: Maybe<Users_Aggregate_Fields>;
  nodes: Array<Users>;
};

/** aggregate fields of "users" */
export type Users_Aggregate_Fields = {
  __typename?: "users_aggregate_fields";
  count: Scalars["Int"]["output"];
  max?: Maybe<Users_Max_Fields>;
  min?: Maybe<Users_Min_Fields>;
};

/** aggregate fields of "users" */
export type Users_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Users_Select_Column>>;
  distinct?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** Boolean expression to filter rows from the table "users". All fields are combined with a logical 'AND'. */
export type Users_Bool_Exp = {
  _and?: InputMaybe<Array<Users_Bool_Exp>>;
  _hasyx_schema_name?: InputMaybe<String_Comparison_Exp>;
  _hasyx_table_name?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Users_Bool_Exp>;
  _or?: InputMaybe<Array<Users_Bool_Exp>>;
  accounts?: InputMaybe<Accounts_Bool_Exp>;
  accounts_aggregate?: InputMaybe<Accounts_Aggregate_Bool_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  email?: InputMaybe<String_Comparison_Exp>;
  email_verified?: InputMaybe<Timestamptz_Comparison_Exp>;
  hasura_role?: InputMaybe<String_Comparison_Exp>;
  hasyx?: InputMaybe<Hasyx_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  image?: InputMaybe<String_Comparison_Exp>;
  is_admin?: InputMaybe<Boolean_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  notification_messages?: InputMaybe<Notification_Messages_Bool_Exp>;
  notification_messages_aggregate?: InputMaybe<Notification_Messages_Aggregate_Bool_Exp>;
  notification_permissions?: InputMaybe<Notification_Permissions_Bool_Exp>;
  notification_permissions_aggregate?: InputMaybe<Notification_Permissions_Aggregate_Bool_Exp>;
  password?: InputMaybe<String_Comparison_Exp>;
  payment_methods?: InputMaybe<Payment_Methods_Bool_Exp>;
  payment_methods_aggregate?: InputMaybe<Payment_Methods_Aggregate_Bool_Exp>;
  payments?: InputMaybe<Payments_Bool_Exp>;
  payments_aggregate?: InputMaybe<Payments_Aggregate_Bool_Exp>;
  subscription_plans_created?: InputMaybe<Subscription_Plans_Bool_Exp>;
  subscription_plans_created_aggregate?: InputMaybe<Subscription_Plans_Aggregate_Bool_Exp>;
  subscriptions?: InputMaybe<Subscriptions_Bool_Exp>;
  subscriptions_aggregate?: InputMaybe<Subscriptions_Aggregate_Bool_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "users" */
export enum Users_Constraint {
  /** unique or primary key constraint on columns "email" */
  UsersEmailKey = "users_email_key",
  /** unique or primary key constraint on columns "id" */
  UsersPkey = "users_pkey",
}

/** input type for inserting data into table "users" */
export type Users_Insert_Input = {
  accounts?: InputMaybe<Accounts_Arr_Rel_Insert_Input>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  email?: InputMaybe<Scalars["String"]["input"]>;
  email_verified?: InputMaybe<Scalars["timestamptz"]["input"]>;
  hasura_role?: InputMaybe<Scalars["String"]["input"]>;
  hasyx?: InputMaybe<Hasyx_Obj_Rel_Insert_Input>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  image?: InputMaybe<Scalars["String"]["input"]>;
  is_admin?: InputMaybe<Scalars["Boolean"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  notification_messages?: InputMaybe<Notification_Messages_Arr_Rel_Insert_Input>;
  notification_permissions?: InputMaybe<Notification_Permissions_Arr_Rel_Insert_Input>;
  password?: InputMaybe<Scalars["String"]["input"]>;
  payment_methods?: InputMaybe<Payment_Methods_Arr_Rel_Insert_Input>;
  payments?: InputMaybe<Payments_Arr_Rel_Insert_Input>;
  subscription_plans_created?: InputMaybe<Subscription_Plans_Arr_Rel_Insert_Input>;
  subscriptions?: InputMaybe<Subscriptions_Arr_Rel_Insert_Input>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
};

/** aggregate max on columns */
export type Users_Max_Fields = {
  __typename?: "users_max_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  email?: Maybe<Scalars["String"]["output"]>;
  email_verified?: Maybe<Scalars["timestamptz"]["output"]>;
  hasura_role?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  image?: Maybe<Scalars["String"]["output"]>;
  name?: Maybe<Scalars["String"]["output"]>;
  password?: Maybe<Scalars["String"]["output"]>;
  updated_at?: Maybe<Scalars["timestamptz"]["output"]>;
};

/** aggregate min on columns */
export type Users_Min_Fields = {
  __typename?: "users_min_fields";
  _hasyx_schema_name?: Maybe<Scalars["String"]["output"]>;
  _hasyx_table_name?: Maybe<Scalars["String"]["output"]>;
  created_at?: Maybe<Scalars["timestamptz"]["output"]>;
  email?: Maybe<Scalars["String"]["output"]>;
  email_verified?: Maybe<Scalars["timestamptz"]["output"]>;
  hasura_role?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["uuid"]["output"]>;
  image?: Maybe<Scalars["String"]["output"]>;
  name?: Maybe<Scalars["String"]["output"]>;
  password?: Maybe<Scalars["String"]["output"]>;
  updated_at?: Maybe<Scalars["timestamptz"]["output"]>;
};

/** response of any mutation on the table "users" */
export type Users_Mutation_Response = {
  __typename?: "users_mutation_response";
  /** number of rows affected by the mutation */
  affected_rows: Scalars["Int"]["output"];
  /** data from the rows affected by the mutation */
  returning: Array<Users>;
};

/** input type for inserting object relation for remote table "users" */
export type Users_Obj_Rel_Insert_Input = {
  data: Users_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Users_On_Conflict>;
};

/** on_conflict condition type for table "users" */
export type Users_On_Conflict = {
  constraint: Users_Constraint;
  update_columns?: Array<Users_Update_Column>;
  where?: InputMaybe<Users_Bool_Exp>;
};

/** Ordering options when selecting data from "users". */
export type Users_Order_By = {
  _hasyx_schema_name?: InputMaybe<Order_By>;
  _hasyx_table_name?: InputMaybe<Order_By>;
  accounts_aggregate?: InputMaybe<Accounts_Aggregate_Order_By>;
  created_at?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  email_verified?: InputMaybe<Order_By>;
  hasura_role?: InputMaybe<Order_By>;
  hasyx?: InputMaybe<Hasyx_Order_By>;
  id?: InputMaybe<Order_By>;
  image?: InputMaybe<Order_By>;
  is_admin?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  notification_messages_aggregate?: InputMaybe<Notification_Messages_Aggregate_Order_By>;
  notification_permissions_aggregate?: InputMaybe<Notification_Permissions_Aggregate_Order_By>;
  password?: InputMaybe<Order_By>;
  payment_methods_aggregate?: InputMaybe<Payment_Methods_Aggregate_Order_By>;
  payments_aggregate?: InputMaybe<Payments_Aggregate_Order_By>;
  subscription_plans_created_aggregate?: InputMaybe<Subscription_Plans_Aggregate_Order_By>;
  subscriptions_aggregate?: InputMaybe<Subscriptions_Aggregate_Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: users */
export type Users_Pk_Columns_Input = {
  id: Scalars["uuid"]["input"];
};

/** select columns of table "users" */
export enum Users_Select_Column {
  /** column name */
  HasyxSchemaName = "_hasyx_schema_name",
  /** column name */
  HasyxTableName = "_hasyx_table_name",
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  Email = "email",
  /** column name */
  EmailVerified = "email_verified",
  /** column name */
  HasuraRole = "hasura_role",
  /** column name */
  Id = "id",
  /** column name */
  Image = "image",
  /** column name */
  IsAdmin = "is_admin",
  /** column name */
  Name = "name",
  /** column name */
  Password = "password",
  /** column name */
  UpdatedAt = "updated_at",
}

/** input type for updating data in table "users" */
export type Users_Set_Input = {
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  email?: InputMaybe<Scalars["String"]["input"]>;
  email_verified?: InputMaybe<Scalars["timestamptz"]["input"]>;
  hasura_role?: InputMaybe<Scalars["String"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  image?: InputMaybe<Scalars["String"]["input"]>;
  is_admin?: InputMaybe<Scalars["Boolean"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  password?: InputMaybe<Scalars["String"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
};

/** Streaming cursor of the table "users" */
export type Users_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Users_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Users_Stream_Cursor_Value_Input = {
  _hasyx_schema_name?: InputMaybe<Scalars["String"]["input"]>;
  _hasyx_table_name?: InputMaybe<Scalars["String"]["input"]>;
  created_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
  email?: InputMaybe<Scalars["String"]["input"]>;
  email_verified?: InputMaybe<Scalars["timestamptz"]["input"]>;
  hasura_role?: InputMaybe<Scalars["String"]["input"]>;
  id?: InputMaybe<Scalars["uuid"]["input"]>;
  image?: InputMaybe<Scalars["String"]["input"]>;
  is_admin?: InputMaybe<Scalars["Boolean"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  password?: InputMaybe<Scalars["String"]["input"]>;
  updated_at?: InputMaybe<Scalars["timestamptz"]["input"]>;
};

/** update columns of table "users" */
export enum Users_Update_Column {
  /** column name */
  CreatedAt = "created_at",
  /** column name */
  Email = "email",
  /** column name */
  EmailVerified = "email_verified",
  /** column name */
  HasuraRole = "hasura_role",
  /** column name */
  Id = "id",
  /** column name */
  Image = "image",
  /** column name */
  IsAdmin = "is_admin",
  /** column name */
  Name = "name",
  /** column name */
  Password = "password",
  /** column name */
  UpdatedAt = "updated_at",
}

export type Users_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Users_Set_Input>;
  /** filter the rows which have to be updated */
  where: Users_Bool_Exp;
};

/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
export type Uuid_Comparison_Exp = {
  _eq?: InputMaybe<Scalars["uuid"]["input"]>;
  _gt?: InputMaybe<Scalars["uuid"]["input"]>;
  _gte?: InputMaybe<Scalars["uuid"]["input"]>;
  _in?: InputMaybe<Array<Scalars["uuid"]["input"]>>;
  _is_null?: InputMaybe<Scalars["Boolean"]["input"]>;
  _lt?: InputMaybe<Scalars["uuid"]["input"]>;
  _lte?: InputMaybe<Scalars["uuid"]["input"]>;
  _neq?: InputMaybe<Scalars["uuid"]["input"]>;
  _nin?: InputMaybe<Array<Scalars["uuid"]["input"]>>;
};
