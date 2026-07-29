import { TestBed } from '@angular/core/testing';
import { SidebarService, SIDEBAR_STORAGE_KEY } from './sidebar.service';

describe('SidebarService', () => {
  // A fresh singleton per call so the constructor re-reads localStorage,
  // which is how a real page reload behaves.
  function freshService(): SidebarService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(SidebarService);
  }

  beforeEach(() => {
    localStorage.clear();
  });

  describe('default state', () => {
    it('is expanded (not collapsed) when nothing is stored', () => {
      const service = freshService();
      expect(service.collapsed()).toBe(false);
    });
  });

  describe('toggle', () => {
    it('flips expanded -> collapsed -> expanded', () => {
      const service = freshService();

      expect(service.collapsed()).toBe(false);
      service.toggle();
      expect(service.collapsed()).toBe(true);
      service.toggle();
      expect(service.collapsed()).toBe(false);
    });
  });

  describe('setCollapsed', () => {
    it('sets the explicit state', () => {
      const service = freshService();

      service.setCollapsed(true);
      expect(service.collapsed()).toBe(true);

      service.setCollapsed(false);
      expect(service.collapsed()).toBe(false);
    });
  });

  describe('persistence', () => {
    it('writes the collapsed state to localStorage', () => {
      const service = freshService();

      service.toggle();
      expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');

      service.toggle();
      expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('false');
    });

    it('a fresh instance reads back the previously stored state', () => {
      const first = freshService();
      first.toggle();
      expect(first.collapsed()).toBe(true);

      // Simulate a reload: a brand-new instance should restore the stored value.
      const second = freshService();
      expect(second.collapsed()).toBe(true);
    });
  });

  describe('invalid stored value', () => {
    it('falls back to the expanded default when the value is malformed', () => {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, 'not-a-boolean');

      let service!: SidebarService;
      expect(() => {
        service = freshService();
      }).not.toThrow();
      expect(service.collapsed()).toBe(false);
    });

    it('falls back to the expanded default when the value is empty', () => {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, '');

      const service = freshService();
      expect(service.collapsed()).toBe(false);
    });
  });
});
