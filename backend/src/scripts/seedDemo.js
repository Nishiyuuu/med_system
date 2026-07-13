import { run } from '../../seed/seedDatabase.js';

run()
  .catch(async error => {
    console.error('\nSeed bazy demonstracyjnej przerwany.');
    console.error(error);
    process.exit(1);
  });
