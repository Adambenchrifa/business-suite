import { Logger } from './logger';

export class Container {
  private static instance: Container;
  private services = new Map<string, any>();
  private factories = new Map<string, () => any>();
  private logger = new Logger('DependencyInjectionContainer');

  private constructor() {}

  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Registers a pre-instantiated singleton service instance.
   */
  public register<T>(name: string, service: T): void {
    if (this.services.has(name)) {
      this.logger.warn(`Overriding registered service: [${name}]`);
    }
    this.services.set(name, service);
    this.logger.debug(`Service successfully registered: [${name}]`);
  }

  /**
   * Registers a lazy factory function that initializes a service upon first retrieval.
   */
  public registerFactory<T>(name: string, factory: () => T): void {
    this.factories.set(name, factory);
    this.logger.debug(`Service factory successfully registered: [${name}]`);
  }

  /**
   * Retrieves a registered service instance, building it via its factory if needed.
   */
  public resolve<T>(name: string): T {
    if (this.services.has(name)) {
      return this.services.get(name) as T;
    }

    const factory = this.factories.get(name);
    if (factory) {
      const service = factory();
      this.services.set(name, service);
      return service as T;
    }

    throw new Error(`Dependency [${name}] could not be resolved by the container`);
  }

  /**
   * Clears the container (useful for sanitizing state between unit test runs).
   */
  public clear(): void {
    this.services.clear();
    this.factories.clear();
  }
}

export const diContainer = Container.getInstance();
export const CORE_SERVICES = {
  Logger: 'SystemLogger',
  DatabasePool: 'DatabasePool',
};
