import { TestBed } from '@angular/core/testing';
import { instance } from 'ts-mockito';

import { QueryService } from './query.service';
import { MysqlService } from './mysql.service';
import { MockedMysqlService } from '../test-utils/mocks';
import { TableRow } from '../types';

interface MockRow extends TableRow {
  entry: number;
  name: string;
  subname: string;
  attribute1: number;
  attribute2: number;
}

interface MockTwoKeysRow extends TableRow {
  pk1: number;
  pk2: number;
  name: string;
  attribute1: number;
  attribute2: number;
}

describe('QueryService', () => {
  let service: QueryService;

  beforeEach(() => TestBed.configureTestingModule({
    providers: [
      { provide : MysqlService, useValue: instance(MockedMysqlService) },
    ]
  }));

  beforeEach(() => {
    service = TestBed.get(QueryService);
  });

  describe('Query builders', () => {
    const tableName = 'my_table';

    describe('getUpdateQuery', () => {
      const primaryKey = 'entry';
      const currentRow: MockRow = { entry: 1234, name: 'Shin', subname: 'AC-Dev', attribute1: 25, attribute2: 4 };

      it('should return empty string when there are no differences', () => {
        expect(service.getUpdateQuery(tableName, primaryKey, currentRow, currentRow)).toEqual('');
      });

      it('should correctly generate queries', () => {

        for (const { newRow, expectedQuery } of [
          {
            newRow: { entry: 1234, name: 'Helias', subname: 'AC-Dev', attribute1: 25, attribute2: 4 } ,
            expectedQuery:
              'UPDATE `my_table` SET `name` = \'Helias\' WHERE (`entry` = 1234);',
          },
          {
            newRow: { entry: 1234, name: 'Shin', subname: 'AC-Web-Dev', attribute1: 25, attribute2: 14 } ,
            expectedQuery:
              'UPDATE `my_table` SET `subname` = \'AC-Web-Dev\', `attribute2` = 14 WHERE (`entry` = 1234);',
          },
          {
            newRow: { entry: 1234, name: 'Helias', subname: 'AC-Web-Dev', attribute1: 25, attribute2: 14 } ,
            expectedQuery:
              'UPDATE `my_table` SET `name` = \'Helias\', `subname` = \'AC-Web-Dev\', `attribute2` = 14 WHERE (`entry` = 1234);',
          },
        ]) {
          expect(service.getUpdateQuery(tableName, primaryKey, currentRow, newRow)).toEqual(expectedQuery);
        }
      });
    });

    describe('getDiffDeleteInsertTwoKeysQuery', () => {
      const primaryKey1 = 'pk1';
      const primaryKey2 = 'pk2';

      const myRows: MockTwoKeysRow[] = [
        { pk1: 1234, pk2: 1, name: 'Shin', attribute1: 28, attribute2: 4 },
        { pk1: 1234, pk2: 2, name: 'Helias', attribute1: 12, attribute2: 4 },
        { pk1: 1234, pk2: 3, name: 'Kalhac', attribute1: 12, attribute2: 4 },
      ];

      it('should return empty string if currentRows or newRows are null', () => {
        expect(service.getDiffDeleteInsertTwoKeysQuery(tableName, primaryKey1, primaryKey2, null, [])).toEqual('');
        expect(service.getDiffDeleteInsertTwoKeysQuery(tableName, primaryKey1, primaryKey2, [], null)).toEqual('');
      });

      it('should correctly work when all rows are deleted', () => {
        expect(service.getDiffDeleteInsertTwoKeysQuery(tableName, primaryKey1, primaryKey2, myRows, [])).toEqual(
          'DELETE FROM `my_table` WHERE `pk1` = 1234;\n'
        );
      });

      it('should correctly work when there are no changes', () => {
        expect(service.getDiffDeleteInsertTwoKeysQuery(tableName, primaryKey1, primaryKey2, myRows, myRows)).toEqual(
          '-- There are no changes'
        );
      });

      it('should correctly work when adding new rows to an empty set', () => {
        expect(service.getDiffDeleteInsertTwoKeysQuery(tableName, primaryKey1, primaryKey2, [], myRows)).toEqual(
          'DELETE' + ' FROM `my_table` WHERE (`pk1` = 1234) AND (`pk2` IN (1, 2, 3));\n' +
          'INSERT' + ' INTO `my_table` (`pk1`, `pk2`, `name`, `attribute1`, `attribute2`) VALUES\n' +
          '(1234, 1, \'Shin\', 28, 4),\n' +
          '(1234, 2, \'Helias\', 12, 4),\n' +
          '(1234, 3, \'Kalhac\', 12, 4);\n'
        );
      });

      it('should correctly work when editing rows', () => {
        const newRows = myRows.map(x => Object.assign({}, x));
        // edit two existing rows
        newRows[1].name = 'Helias2';
        newRows[2].name = 'Kalhac2';

        expect(service.getDiffDeleteInsertTwoKeysQuery(tableName, primaryKey1, primaryKey2, myRows, newRows)).toEqual(
          'DELETE' + ' FROM `my_table` WHERE (`pk1` = 1234) AND (`pk2` IN (2, 3));\n' +
          'INSERT' + ' INTO `my_table` (`pk1`, `pk2`, `name`, `attribute1`, `attribute2`) VALUES\n' +
          '(1234, 2, \'Helias2\', 12, 4),\n' +
          '(1234, 3, \'Kalhac2\', 12, 4);\n'
        );
      });

      it('should correctly work when adding rows', () => {
        const newRows = myRows.map(x => Object.assign({}, x));
        // add two new rows
        newRows.push({ pk1: 1234, pk2: 4, name: 'Yehonal', attribute1: 99, attribute2: 0 });
        newRows.push({ pk1: 1234, pk2: 5, name: 'Barbz', attribute1: 68, attribute2: 1 });

        expect(service.getDiffDeleteInsertTwoKeysQuery(tableName, primaryKey1, primaryKey2, myRows, newRows)).toEqual(
          'DELETE' + ' FROM `my_table` WHERE (`pk1` = 1234) AND (`pk2` IN (4, 5));\n' +
          'INSERT' + ' INTO `my_table` (`pk1`, `pk2`, `name`, `attribute1`, `attribute2`) VALUES\n' +
          '(1234, 4, \'Yehonal\', 99, 0),\n' +
          '(1234, 5, \'Barbz\', 68, 1);\n'
        );
      });

      it('should correctly work when removing rows', () => {
        const newRows = [ { ...myRows[0] }, { ...myRows[2] }]; // delete second row

        expect(service.getDiffDeleteInsertTwoKeysQuery(tableName, primaryKey1, primaryKey2, myRows, newRows)).toEqual(
          'DELETE' + ' FROM `my_table` WHERE (`pk1` = 1234) AND (`pk2` IN (2));\n'
        );
      });

      it('should correctly work when removing, editing and adding rows all together', () => {
        const newRows = [ { ...myRows[0] }, { ...myRows[2] }]; // delete second row
        newRows[1].name = 'Kalhac2'; // edit row
        newRows.push({ pk1: 1234, pk2: 4, name: 'Yehonal', attribute1: 99, attribute2: 0 }); // add a new row

        expect(service.getDiffDeleteInsertTwoKeysQuery(tableName, primaryKey1, primaryKey2, myRows, newRows)).toEqual(
          'DELETE' + ' FROM `my_table` WHERE (`pk1` = 1234) AND (`pk2` IN (2, 3, 4));\n' +
          'INSERT' + ' INTO `my_table` (`pk1`, `pk2`, `name`, `attribute1`, `attribute2`) VALUES\n' +
          '(1234, 3, \'Kalhac2\', 12, 4),\n' +
          '(1234, 4, \'Yehonal\', 99, 0);\n'
        );
      });
    });

    describe('getDiffDeleteInsertOneKeyQuery', () => {
      const primaryKey = 'entry';

      const myRows: MockRow[] = [
        { entry: 1, name: 'Shin', subname: 'AC-Dev', attribute1: 28, attribute2: 4 },
        { entry: 2, name: 'Helias', subname: 'AC-Dev', attribute1: 12, attribute2: 4 },
        { entry: 3, name: 'Kalhac', subname: 'AC-Dev', attribute1: 12, attribute2: 4 },
      ];

      it('should return empty string if currentRows or newRows are null', () => {
        expect(service.getDiffDeleteInsertOneKeyQuery(tableName, primaryKey, null, [])).toEqual('');
        expect(service.getDiffDeleteInsertOneKeyQuery(tableName, primaryKey, [], null)).toEqual('');
      });

      it('should correctly work when all rows are deleted', () => {
        expect(service.getDiffDeleteInsertOneKeyQuery(tableName, primaryKey, myRows, [])).toEqual(
          'DELETE FROM `my_table` WHERE (`entry` IN (1, 2, 3));\n'
        );
      });

      it('should correctly work when there are no changes', () => {
        expect(service.getDiffDeleteInsertOneKeyQuery(tableName, primaryKey, myRows, myRows)).toEqual(
          '-- There are no changes'
        );
      });

      it('should correctly work when adding new rows to an empty set', () => {
        expect(service.getDiffDeleteInsertOneKeyQuery(tableName, primaryKey, [], myRows)).toEqual(
          'DELETE' + ' FROM `my_table` WHERE (`entry` IN (1, 2, 3));\n' +
          'INSERT' + ' INTO `my_table` (`entry`, `name`, `subname`, `attribute1`, `attribute2`) VALUES\n' +
          '(1, \'Shin\', \'AC-Dev\', 28, 4),\n' +
          '(2, \'Helias\', \'AC-Dev\', 12, 4),\n' +
          '(3, \'Kalhac\', \'AC-Dev\', 12, 4);\n'
        );
      });

      it('should correctly work when editing rows', () => {
        const newRows = myRows.map(x => Object.assign({}, x));
        // edit two existing rows
        newRows[1].name = 'Helias2';
        newRows[2].name = 'Kalhac2';

        expect(service.getDiffDeleteInsertOneKeyQuery(tableName, primaryKey, myRows, newRows)).toEqual(
          'DELETE' + ' FROM `my_table` WHERE (`entry` IN (2, 3));\n' +
          'INSERT' + ' INTO `my_table` (`entry`, `name`, `subname`, `attribute1`, `attribute2`) VALUES\n' +
          '(2, \'Helias2\', \'AC-Dev\', 12, 4),\n' +
          '(3, \'Kalhac2\', \'AC-Dev\', 12, 4);\n'
        );
      });

      it('should correctly work when adding rows', () => {
        const newRows = myRows.map(x => Object.assign({}, x));
        // add two new rows
        newRows.push({ entry: 4, name: 'Yehonal', subname: 'AC-Dev', attribute1: 99, attribute2: 0 });
        newRows.push({ entry: 5, name: 'Barbz', subname: 'AC-Dev', attribute1: 68, attribute2: 1 });

        expect(service.getDiffDeleteInsertOneKeyQuery(tableName, primaryKey, myRows, newRows)).toEqual(
          'DELETE' + ' FROM `my_table` WHERE (`entry` IN (4, 5));\n' +
          'INSERT' + ' INTO `my_table` (`entry`, `name`, `subname`, `attribute1`, `attribute2`) VALUES\n' +
          '(4, \'Yehonal\', \'AC-Dev\', 99, 0),\n' +
          '(5, \'Barbz\', \'AC-Dev\', 68, 1);\n'
        );
      });

      it('should correctly work when removing rows', () => {
        const newRows = [ { ...myRows[0] }, { ...myRows[2] }]; // delete second row

        expect(service.getDiffDeleteInsertOneKeyQuery(tableName, primaryKey, myRows, newRows)).toEqual(
          'DELETE' + ' FROM `my_table` WHERE (`entry` IN (2));\n'
        );
      });

      it('should correctly work when removing, editing and adding rows all together', () => {
        const newRows = [ { ...myRows[0] }, { ...myRows[2] }]; // delete second row
        newRows[1].name = 'Kalhac2'; // edit row
        newRows.push({ entry: 4, name: 'Yehonal', subname: 'AC-Dev', attribute1: 99, attribute2: 0 }); // add a new row

        expect(service.getDiffDeleteInsertOneKeyQuery(tableName, primaryKey, myRows, newRows)).toEqual(
          'DELETE' + ' FROM `my_table` WHERE (`entry` IN (2, 3, 4));\n' +
          'INSERT' + ' INTO `my_table` (`entry`, `name`, `subname`, `attribute1`, `attribute2`) VALUES\n' +
          '(3, \'Kalhac2\', \'AC-Dev\', 12, 4),\n' +
          '(4, \'Yehonal\', \'AC-Dev\', 99, 0);\n'
        );
      });
    });

    describe('getFullDeleteInsertQuery', () => {
      const primaryKey = 'pk1';

      it('it should return empty string if the array of rows is empty or null', () => {
        expect(service.getFullDeleteInsertQuery(tableName, [], primaryKey)).toEqual('');
        expect(service.getFullDeleteInsertQuery(tableName, null, primaryKey)).toEqual('');
      });

      describe('one key', () => {
        it('should correctly work when adding a group of rows', () => {
          const rows: MockTwoKeysRow[] = [
            { pk1: 1234, pk2: 1, name: 'Shin', attribute1: 28, attribute2: 4 },
            { pk1: 1234, pk2: 2, name: 'Helias', attribute1: 12, attribute2: 4 },
            { pk1: 1234, pk2: 3, name: 'Kalhac', attribute1: 12, attribute2: 4 },
          ];

          expect(service.getFullDeleteInsertQuery(tableName, rows, primaryKey)).toEqual(
            'DELETE' + ' FROM `my_table` WHERE (`pk1` = 1234);\n' +
            'INSERT' + ' INTO `my_table` (`pk1`, `pk2`, `name`, `attribute1`, `attribute2`) VALUES\n' +
            '(1234, 1, \'Shin\', 28, 4),\n' +
            '(1234, 2, \'Helias\', 12, 4),\n' +
            '(1234, 3, \'Kalhac\', 12, 4);\n'
          );
        });

        it('should correctly work when adding a single row', () => {
          const rows: MockTwoKeysRow[] = [
            { pk1: 1234, pk2: 1, name: 'Shin', attribute1: 28, attribute2: 4 },
          ];

          expect(service.getFullDeleteInsertQuery(tableName, rows, primaryKey)).toEqual(
            'DELETE' + ' FROM `my_table` WHERE (`pk1` = 1234);\n' +
            'INSERT' + ' INTO `my_table` (`pk1`, `pk2`, `name`, `attribute1`, `attribute2`) VALUES\n' +
            '(1234, 1, \'Shin\', 28, 4);\n'
          );
        });
      });

      describe('two keys', () => {
        const primaryKey2 = 'pk2';

        it('should correctly work when adding a group of rows', () => {
          const rows: MockTwoKeysRow[] = [
            { pk1: 1234, pk2: 1, name: 'Shin', attribute1: 28, attribute2: 4 },
            { pk1: 1234, pk2: 2, name: 'Helias', attribute1: 12, attribute2: 4 },
            { pk1: 1234, pk2: 3, name: 'Kalhac', attribute1: 12, attribute2: 4 },
          ];

          expect(service.getFullDeleteInsertQuery(tableName, rows, primaryKey, primaryKey2)).toEqual(
            'DELETE' + ' FROM `my_table` WHERE (`pk1` = 1234 AND `pk2` IN (1, 2, 3));\n' +
            'INSERT' + ' INTO `my_table` (`pk1`, `pk2`, `name`, `attribute1`, `attribute2`) VALUES\n' +
            '(1234, 1, \'Shin\', 28, 4),\n' +
            '(1234, 2, \'Helias\', 12, 4),\n' +
            '(1234, 3, \'Kalhac\', 12, 4);\n'
          );
        });

        it('should correctly work when adding a single row', () => {
          const rows: MockTwoKeysRow[] = [
            { pk1: 1234, pk2: 1, name: 'Shin', attribute1: 28, attribute2: 4 },
          ];

          expect(service.getFullDeleteInsertQuery(tableName, rows, primaryKey, primaryKey2)).toEqual(
            'DELETE' + ' FROM `my_table` WHERE (`pk1` = 1234 AND `pk2` IN (1));\n' +
            'INSERT' + ' INTO `my_table` (`pk1`, `pk2`, `name`, `attribute1`, `attribute2`) VALUES\n' +
            '(1234, 1, \'Shin\', 28, 4);\n'
          );
        });
      });

    });
  });
});
