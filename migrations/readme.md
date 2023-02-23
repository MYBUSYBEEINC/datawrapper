## How the SQL migrations work

Each core migration is stored as individual file in this folder. Plugins may also define additional migrations in their own `plugins/*/migrations` folders.

The migration file follows a simple structure with an `Up` and `Down` section.

```sql
-- Up
CREATE TABLE `schema` (
    `scope` varchar(100) NOT NULL,
    version INT NULL,
    PRIMARY KEY (`scope`)
) ENGINE=InnoDB;

-- Down
DROP TABLE IF EXISTS `schema`;

```

When running the migrations we are parsing the SQL files for the part stored in the "Up" section. The migration file is prefixed with a schema version number. So the file `migrations/018-logo-setting.sql` would be version `18` for the scope `core`, while `plugins/river/migrations/005-add-num-forks.sql` would be version `5` for the scope `river`.

We're storing the current version per scope in the `schema` relation. After a migration is run, the corresponding version will be updated.

### How and when are these migrations run?

The script [`scripts/sync-db.js`](../scripts/sync-db.js) can be used to run database migrations (e.g. in CI).

When starting the local Docker setup using `make dev`, a Docker container `mysql-sync` is started which runs the migration script automatically.
